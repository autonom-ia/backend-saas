/**
 * HTTP client for financial-service API.
 * Used to create account subscriptions and associate onboarding data (cliente que já pagou antes de ter conta/assinatura) after account creation.
 * When FINANCIAL_SERVICE_CREATE_SUBSCRIPTION_FUNCTION is set, uses Lambda.invoke instead of HTTP (evita sair da VPC; Lambdas em VPC sem NAT não alcançam a internet).
 */

const getBaseUrl = () => {
  const url = process.env.FINANCIAL_SERVICE_URL || '';
  return url.replace(/\/$/, '');
};

const getCreateSubscriptionFunctionName = () =>
  process.env.FINANCIAL_SERVICE_CREATE_SUBSCRIPTION_FUNCTION || '';
const getAssociateOnboardingFunctionName = () =>
  process.env.FINANCIAL_SERVICE_ASSOCIATE_ONBOARDING_FUNCTION || '';

/**
 * Invoke financial-service Lambda with API Gateway-shaped event; parse response body.
 * @param {string} functionName - Lambda function name
 * @param {{ body: string, headers?: Record<string, string> }} event - APIGatewayProxyEvent-like
 * @returns {Promise<{ statusCode: number, body?: string }>}
 */
const invokeFinancialLambda = async (functionName, event) => {
  if (!functionName) return null;
  try {
    const Lambda = require('@aws-sdk/client-lambda');
    const lambda = new Lambda.LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const payload = Buffer.from(JSON.stringify(event), 'utf8');
    const result = await lambda.send(
      new Lambda.InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: payload,
      })
    );
    if (result.FunctionError) {
      console.error('[financial-service-client] Lambda invoke error', {
        functionName,
        error: result.FunctionError,
        payload: result.Payload ? result.Payload.toString() : '',
      });
      return null;
    }
    const raw = result.Payload
      ? (Buffer.isBuffer(result.Payload) ? result.Payload : Buffer.from(result.Payload)).toString('utf8')
      : '{}';
    let out;
    try {
      out = JSON.parse(raw);
    } catch {
      return null;
    }
    return { statusCode: out.statusCode || 0, body: out.body };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('[financial-service-client] Lambda invoke exception', {
      functionName,
      error: msg,
    });
    if (msg.includes('ETIMEDOUT') || msg.includes('connect')) {
      console.warn('[financial-service-client] Lambda em VPC precisa de VPC Endpoint para Lambda. Veja backend-saas/docs/VPC_ENDPOINT_LAMBDA.md');
    }
    return null;
  }
};

/**
 * @param {string} token - Cognito JWT (Bearer token value, without "Bearer " prefix is ok)
 * @returns {Promise<Object[]>} List of product plans
 */
const getProductPlansByProductId = async (productId, token) => {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.warn('[financial-service-client] FINANCIAL_SERVICE_URL not set, skipping getProductPlansByProductId');
    return [];
  }
  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/product-plans?productId=${encodeURIComponent(productId)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });
    if (!res.ok) {
      console.error('[financial-service-client] getProductPlansByProductId failed', { status: res.status, productId });
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data.data || []);
  } catch (err) {
    console.error('[financial-service-client] getProductPlansByProductId error', { productId, error: err?.message || err });
    return [];
  }
};

/**
 * @param {Object} body - { document, companyId? }
 * @param {string} token - Cognito JWT
 * @returns {Promise<{ productPlanId: string|null }|null>} Resolve result or null on failure
 */
const resolvePlanFromOnboarding = async (body, token) => {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.warn('[financial-service-client] FINANCIAL_SERVICE_URL not set, skipping resolvePlanFromOnboarding');
    return null;
  }
  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/account-subscriptions/resolve-plan-from-onboarding`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[financial-service-client] resolvePlanFromOnboarding failed', { status: res.status, body: text });
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[financial-service-client] resolvePlanFromOnboarding error', { error: err?.message || err });
    return null;
  }
};

/**
 * @param {Object} body - { accountId, productPlanId, customPrice?, currency?, cycle? }
 * @param {string} token - Cognito JWT
 * @returns {Promise<Object|null>} Created account subscription or null on failure
 */
const createAccountSubscription = async (body, token) => {
  const fnName = getCreateSubscriptionFunctionName();
  if (fnName) {
    const lambdaEvent = { body: JSON.stringify(body) };
    const response = await invokeFinancialLambda(fnName, lambdaEvent);
    if (!response || response.statusCode !== 201) {
      console.error('[financial-service-client] createAccountSubscription (Lambda) failed', {
        statusCode: response?.statusCode,
        body: response?.body,
      });
      return null;
    }
    let json;
    try {
      json = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } catch {
      return null;
    }
    const sub = json?.data != null ? json.data : json;
    if (!sub || sub.id == null) {
      console.error('[financial-service-client] createAccountSubscription (Lambda) unexpected shape', { json });
      return null;
    }
    return sub;
  }
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.warn('[financial-service-client] FINANCIAL_SERVICE_URL not set, skipping createAccountSubscription');
    return null;
  }
  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/account-subscriptions`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[financial-service-client] createAccountSubscription failed', {
        status: res.status,
        statusText: res.statusText,
        body: text,
        baseUrl,
        url,
      });
      return null;
    }
    const json = await res.json();
    const sub = json?.data != null ? json.data : json;
    if (!sub || sub.id == null) {
      console.error('[financial-service-client] createAccountSubscription unexpected response shape', { json });
      return null;
    }
    return sub;
  } catch (err) {
    console.error('[financial-service-client] createAccountSubscription error', {
      error: err?.message || err,
      baseUrl: getBaseUrl(),
    });
    return null;
  }
};

/**
 * @param {Object} body - { accountId, accountSubscriptionId, document, companyId? }
 * @param {string} token - Cognito JWT
 * @returns {Promise<Object|null>} Associate result or null on failure
 */
const associateOnboardingData = async (body, token) => {
  const fnName = getAssociateOnboardingFunctionName();
  if (fnName) {
    const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
    const lambdaEvent = {
      body: JSON.stringify(body),
      headers: { Authorization: authHeader },
    };
    const response = await invokeFinancialLambda(fnName, lambdaEvent);
    if (!response || response.statusCode !== 200) {
      console.error('[financial-service-client] associateOnboardingData (Lambda) failed', {
        statusCode: response?.statusCode,
        body: response?.body,
      });
      return null;
    }
    try {
      return typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } catch {
      return null;
    }
  }
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.warn('[financial-service-client] FINANCIAL_SERVICE_URL not set, skipping associateOnboardingData');
    return null;
  }
  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/account-subscriptions/associate-onboarding-data`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[financial-service-client] associateOnboardingData failed', { status: res.status, body: text });
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[financial-service-client] associateOnboardingData error', { error: err?.message || err });
    return null;
  }
};

module.exports = {
  getProductPlansByProductId,
  resolvePlanFromOnboarding,
  createAccountSubscription,
  associateOnboardingData,
};
