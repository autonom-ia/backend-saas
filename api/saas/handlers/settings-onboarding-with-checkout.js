const { success, error: errorResponse } = require('../utils/response');
const { runLpOnboardingAccountCreation } = require('../services/settings-lp-onboarding-account');
const { createAccountSubscription, associateOnboardingData } = require('../services/financial-service-client');
const {
  assertInternalIntegrationToken,
  getFinancialBearerToken,
} = require('../utils/settings-internal-auth');

/**
 * Rota para LP: autenticação por X-Internal-Integration-Token
 * (SETTINGS_ONBOARDING_INTERNAL_TOKEN ou INTERNAL_INTEGRATION_TOKEN no SSM).
 * Sem authorizer Cognito no API Gateway.
 *
 * Com productPlanId: precisa de Bearer para o financial — header Authorization ou
 * SETTINGS_ONBOARDING_FINANCIAL_BEARER_TOKEN no servidor (SSM).
 */
exports.handler = async (event) => {
  try {
    const internal = assertInternalIntegrationToken(event);
    if (!internal.ok) {
      return errorResponse(internal.body, internal.status, event);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400, event);
    }

    const onboardingResult = await runLpOnboardingAccountCreation(event, body);
    if (!onboardingResult.ok) {
      return errorResponse(onboardingResult.body, onboardingResult.httpStatus, event);
    }

    const { account, productPlanId, document, accountPayload } = onboardingResult;

    const token = getFinancialBearerToken(event);
    const companyId = body.companyId ?? body.company_id ?? null;
    const invoiceIdRaw = body.invoiceId ?? body.invoice_id ?? null;
    const invoiceId =
      invoiceIdRaw != null && String(invoiceIdRaw).trim() ? String(invoiceIdRaw).trim() : null;
    const sessionIdRaw = body.sessionId ?? body.session_id ?? null;
    const sessionId =
      sessionIdRaw != null && String(sessionIdRaw).trim() ? String(sessionIdRaw).trim() : null;

    if (!productPlanId) {
      return success(
        {
          success: true,
          message: onboardingResult.message,
          data: {
            account: accountPayload.data,
            subscription: null,
            associateResult: null,
          },
        },
        onboardingResult.httpStatus,
        event
      );
    }

    if (!token) {
      return errorResponse(
        {
          success: false,
          message:
            'Com productPlanId é necessário Bearer para o financial: header Authorization ou SETTINGS_ONBOARDING_FINANCIAL_BEARER_TOKEN no servidor',
        },
        401,
        event
      );
    }

    const customPrice =
      body.customPrice != null ? body.customPrice : body.custom_price != null ? body.custom_price : null;
    const subBody = {
      accountId: account.id,
      productPlanId,
      customPrice,
      currency: body.currency || 'BRL',
    };
    const sub = await createAccountSubscription(subBody, token);
    if (!sub || !sub.id) {
      console.error('[settings-onboarding-with-checkout] Falha createAccountSubscription após criar conta', {
        accountId: account.id,
      });
      return errorResponse(
        {
          success: false,
          message: 'Conta criada, mas falha ao criar assinatura no financial-service',
          partial: true,
          data: { account: accountPayload.data },
        },
        502,
        event
      );
    }

    const doc = document != null ? String(document).trim() : '';
    let associateResult = null;
    if (doc || invoiceId) {
      const associateBody = {
        accountId: account.id,
        accountSubscriptionId: sub.id,
        companyId: companyId || null,
        ...(doc ? { document: doc } : {}),
        ...(invoiceId ? { invoiceId } : {}),
        ...(sessionId ? { sessionId } : {}),
      };
      associateResult = await associateOnboardingData(associateBody, token);
    }

    return success(
      {
        success: true,
        message: 'Conta e assinatura processadas com sucesso',
        data: {
          account: accountPayload.data,
          subscription: sub,
          associateResult,
        },
      },
      200,
      event
    );
  } catch (err) {
    console.error('[settings-onboarding-with-checkout]', err);
    return errorResponse(
      { success: false, message: 'Erro ao processar pedido', error: err.message },
      500,
      event
    );
  }
};
