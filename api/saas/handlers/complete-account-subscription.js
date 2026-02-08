const { success, error: errorResponse } = require('../utils/response');
const { createAccountSubscription, associateOnboardingData } = require('../services/financial-service-client');

/**
 * Handler para completar assinatura quando o usuário escolhe o plano após criar conta
 * (fluxo subscriptionPlanRequired). Cria a assinatura no financial-service e associa dados de onboarding.
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { accountId, productPlanId, document, companyId } = body;

    if (!accountId) {
      return errorResponse({ success: false, message: 'accountId é obrigatório' }, 400);
    }
    if (!productPlanId) {
      return errorResponse({ success: false, message: 'productPlanId é obrigatório' }, 400);
    }

    const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
    const token = (authHeader && authHeader.replace(/^Bearer\s+/i, '').trim()) || '';
    if (!token) {
      return errorResponse({ success: false, message: 'Token de autorização é obrigatório' }, 401);
    }

    const subBody = {
      accountId,
      productPlanId,
      customPrice: body.customPrice != null ? body.customPrice : null,
      currency: body.currency || 'BRL',
    };
    const sub = await createAccountSubscription(subBody, token);
    if (!sub || !sub.id) {
      console.error('[complete-account-subscription] Falha ao criar assinatura no financial-service');
      return errorResponse(
        { success: false, message: 'Falha ao criar assinatura no financial-service' },
        502
      );
    }

    const doc = document != null ? String(document).trim() : '';
    if (doc) {
      await associateOnboardingData(
        {
          accountId,
          accountSubscriptionId: sub.id,
          document: doc,
          companyId: companyId || null,
        },
        token
      );
    }

    return success({
      success: true,
      message: 'Assinatura criada com sucesso',
      data: sub,
    }, 200);
  } catch (err) {
    console.error('Erro ao completar assinatura:', err);
    return errorResponse(
      { success: false, message: 'Erro ao completar assinatura', error: err.message },
      500
    );
  }
};
