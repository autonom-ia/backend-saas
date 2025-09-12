const { updateInbox } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Atualiza um inbox
 */
exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const inboxId = pathParams.inboxId;
    if (!inboxId) {
      return errorResponse({ success: false, message: 'Parâmetro inboxId é obrigatório' }, 400, event);
    }

    const body = JSON.parse(event.body || '{}');
    const { account_id, name } = body;

    const updated = await updateInbox(inboxId, { account_id, name });
    return success({ success: true, data: updated }, 200, event);
  } catch (err) {
    console.error('Erro ao atualizar inbox:', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar inbox', error: err.message }, 500, event);
  }
});
