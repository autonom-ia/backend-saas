const { createInbox } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Cria um inbox
 */
exports.handler = withCors(async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { account_id, name } = body;

    if (!account_id || !name) {
      return errorResponse({ success: false, message: 'account_id e name são obrigatórios' }, 400, event);
    }

    const created = await createInbox({ account_id, name });
    return success({ success: true, data: created }, 201, event);
  } catch (err) {
    console.error('Erro ao criar inbox:', err);
    return errorResponse({ success: false, message: 'Erro ao criar inbox', error: err.message }, 500, event);
  }
});
