const { getInboxById } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Obtém um inbox pelo ID (path param inboxId)
 */
exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const inboxId = pathParams.inboxId;

    if (!inboxId) {
      return errorResponse({ success: false, message: 'Parâmetro inboxId é obrigatório' }, 400, event);
    }

    const data = await getInboxById(inboxId);
    return success({ success: true, data }, 200, event);
  } catch (err) {
    console.error('Erro ao obter inbox:', err);
    return errorResponse({ success: false, message: 'Erro ao obter inbox', error: err.message }, 500, event);
  }
});
