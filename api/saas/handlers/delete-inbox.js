const { deleteInbox } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Remove um inbox por ID
 */
exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const inboxId = pathParams.inboxId;

    if (!inboxId) {
      return errorResponse({ success: false, message: 'Parâmetro inboxId é obrigatório' }, 400, event);
    }

    await deleteInbox(inboxId);
    return success({ success: true }, 200, event);
  } catch (err) {
    console.error('Erro ao remover inbox:', err);
    return errorResponse({ success: false, message: 'Erro ao remover inbox', error: err.message }, 500, event);
  }
});
