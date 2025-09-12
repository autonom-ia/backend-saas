const { listInboxes } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Lista inboxes filtrando por accountId (querystring)
 */
exports.handler = withCors(async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const accountId = qs.accountId;

    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400, event);
    }

    const data = await listInboxes(accountId);
    return success({ success: true, data }, 200, event);
  } catch (err) {
    console.error('Erro ao listar inboxes:', err);
    return errorResponse({ success: false, message: 'Erro ao listar inboxes', error: err.message }, 500, event);
  }
});
