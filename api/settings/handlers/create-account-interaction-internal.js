const { createAccountInteraction } = require('../services/account-interaction-service');
const { success, error } = require('../utils/response');
const { validateInternalIntegrationRequest } = require('../utils/internal-integration-auth');

module.exports.handler = async (event) => {
  const auth = validateInternalIntegrationRequest(event);
  if (auth) {
    return error({ success: false, message: auth.message }, auth.code, event);
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return error({ success: false, message: 'Corpo da requisição inválido' }, 400, event);
    }

    const { accountId, payload, sentAt } = body;
    if (!accountId) {
      return error({ success: false, message: 'accountId é obrigatório' }, 400, event);
    }
    if (payload === undefined || payload === null || (typeof payload !== 'object' && typeof payload !== 'string')) {
      return error(
        { success: false, message: 'payload é obrigatório (objeto JSON ou string)' },
        400,
        event
      );
    }

    const toStore = typeof payload === 'string' ? { value: payload } : payload;
    const created = await createAccountInteraction({
      accountId,
      payload: toStore,
      sentAt: sentAt || null,
    });

    return success({ success: true, data: created }, 201, event);
  } catch (err) {
    console.error('[settings:create-account-interaction-internal] Erro:', err);
    return error(
      { success: false, message: 'Erro ao registrar interação', error: err.message },
      500,
      event
    );
  }
};
