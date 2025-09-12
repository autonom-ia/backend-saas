const { success, error: errorResponse } = require('../utils/response');
const { listTemplateMessages } = require('../services/template-message-service');

exports.handler = async (event) => {
  try {
    const accountId = event?.queryStringParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'accountId é obrigatório' }, 400, event);
    }
    const rows = await listTemplateMessages(accountId);
    return success({ success: true, data: rows }, 200, event);
  } catch (err) {
    console.error('[leadshot/list-template-messages] error:', err);
    return errorResponse({ success: false, message: 'Erro ao listar template_message', error: err.message }, 500, event);
  }
};
