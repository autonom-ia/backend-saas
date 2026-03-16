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

const listAccountSubscriptionsByAccountId = async (userId, accountId, token) => {
  const startedAt = Date.now();
  const baseUrl = getBaseUrl();
  if (!baseUrl || !userId || !accountId) {
    console.warn('[financial-service-client] listAccountSubscriptionsByAccountId skipped', {
      hasBaseUrl: !!baseUrl,
      hasUserId: !!userId,
      hasAccountId: !!accountId,
    });
    return [];
  }

  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/account-subscriptions?userId=${encodeURIComponent(userId)}&accountId=${encodeURIComponent(accountId)}`;

  console.info('[financial-service-client] listAccountSubscriptionsByAccountId started', {
    accountId,
    userId,
    url,
    baseUrl,
  });

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    console.info('[financial-service-client] listAccountSubscriptionsByAccountId response received', {
      accountId,
      status: res.status,
      ok: res.ok,
      elapsedMs: Date.now() - startedAt,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[financial-service-client] listAccountSubscriptionsByAccountId failed', {
        status: res.status,
        body: text,
        accountId,
        elapsedMs: Date.now() - startedAt,
      });
      return [];
    }

    const json = await res.json();
    const subscriptions = Array.isArray(json) ? json : (json.data || []);
    console.info('[financial-service-client] listAccountSubscriptionsByAccountId completed', {
      accountId,
      subscriptionsCount: subscriptions.length,
      elapsedMs: Date.now() - startedAt,
    });
    return subscriptions;
  } catch (err) {
    console.error('[financial-service-client] listAccountSubscriptionsByAccountId error', {
      accountId,
      error: err?.message || err,
      elapsedMs: Date.now() - startedAt,
    });
    return [];
  }
};

const updateAccountSubscription = async (accountSubscriptionId, body, token) => {
  const startedAt = Date.now();
  const baseUrl = getBaseUrl();
  if (!baseUrl || !accountSubscriptionId) {
    console.warn('[financial-service-client] updateAccountSubscription skipped', {
      hasBaseUrl: !!baseUrl,
      hasAccountSubscriptionId: !!accountSubscriptionId,
    });
    return null;
  }

  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/account-subscriptions/${encodeURIComponent(accountSubscriptionId)}`;

  console.info('[financial-service-client] updateAccountSubscription started', {
    accountSubscriptionId,
    url,
    body,
  });

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    console.info('[financial-service-client] updateAccountSubscription response received', {
      accountSubscriptionId,
      status: res.status,
      ok: res.ok,
      elapsedMs: Date.now() - startedAt,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[financial-service-client] updateAccountSubscription failed', {
        status: res.status,
        body: text,
        accountSubscriptionId,
        elapsedMs: Date.now() - startedAt,
      });
      return null;
    }

    const json = await res.json();
    const subscription = json?.data ?? json ?? null;
    console.info('[financial-service-client] updateAccountSubscription completed', {
      accountSubscriptionId,
      updated: !!subscription,
      elapsedMs: Date.now() - startedAt,
    });
    return subscription;
  } catch (err) {
    console.error('[financial-service-client] updateAccountSubscription error', {
      accountSubscriptionId,
      error: err?.message || err,
      elapsedMs: Date.now() - startedAt,
    });
    return null;
  }
};

const listInvoicesByAccountSubscriptionId = async (accountSubscriptionId, token) => {
  const startedAt = Date.now();
  const baseUrl = getBaseUrl();
  if (!baseUrl || !accountSubscriptionId) {
    console.warn('[financial-service-client] listInvoicesByAccountSubscriptionId skipped', {
      hasBaseUrl: !!baseUrl,
      hasAccountSubscriptionId: !!accountSubscriptionId,
    });
    return [];
  }

  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/invoices?accountSubscriptionId=${encodeURIComponent(accountSubscriptionId)}`;

  console.info('[financial-service-client] listInvoicesByAccountSubscriptionId started', {
    accountSubscriptionId,
    url,
  });

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    console.info('[financial-service-client] listInvoicesByAccountSubscriptionId response received', {
      accountSubscriptionId,
      status: res.status,
      ok: res.ok,
      elapsedMs: Date.now() - startedAt,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[financial-service-client] listInvoicesByAccountSubscriptionId failed', {
        status: res.status,
        body: text,
        accountSubscriptionId,
        elapsedMs: Date.now() - startedAt,
      });
      return [];
    }

    const json = await res.json();
    const invoices = Array.isArray(json) ? json : (json.data || []);
    console.info('[financial-service-client] listInvoicesByAccountSubscriptionId completed', {
      accountSubscriptionId,
      invoicesCount: invoices.length,
      elapsedMs: Date.now() - startedAt,
    });
    return invoices;
  } catch (err) {
    console.error('[financial-service-client] listInvoicesByAccountSubscriptionId error', {
      accountSubscriptionId,
      error: err?.message || err,
      elapsedMs: Date.now() - startedAt,
    });
    return [];
  }
};

const cancelInvoice = async (invoiceId, token) => {
  const startedAt = Date.now();
  const baseUrl = getBaseUrl();
  if (!baseUrl || !invoiceId) {
    console.warn('[financial-service-client] cancelInvoice skipped', {
      hasBaseUrl: !!baseUrl,
      hasInvoiceId: !!invoiceId,
    });
    return null;
  }

  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');
  const url = `${baseUrl}/invoices/${encodeURIComponent(invoiceId)}/cancel`;

  console.info('[financial-service-client] cancelInvoice started', {
    invoiceId,
    url,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    console.info('[financial-service-client] cancelInvoice response received', {
      invoiceId,
      status: res.status,
      ok: res.ok,
      elapsedMs: Date.now() - startedAt,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[financial-service-client] cancelInvoice failed', {
        status: res.status,
        body: text,
        invoiceId,
        elapsedMs: Date.now() - startedAt,
      });
      return null;
    }

    const json = await res.json();
    const invoice = json?.data ?? json ?? null;
    console.info('[financial-service-client] cancelInvoice completed', {
      invoiceId,
      canceled: !!invoice,
      elapsedMs: Date.now() - startedAt,
    });
    return invoice;
  } catch (err) {
    console.error('[financial-service-client] cancelInvoice error', {
      invoiceId,
      error: err?.message || err,
      elapsedMs: Date.now() - startedAt,
    });
    return null;
  }
};

module.exports = {
  getProductPlansByProductId,
  resolvePlanFromOnboarding,
  createAccountSubscription,
  associateOnboardingData,
  listAccountSubscriptionsByAccountId,
  updateAccountSubscription,
  listInvoicesByAccountSubscriptionId,
  cancelInvoice,
};
