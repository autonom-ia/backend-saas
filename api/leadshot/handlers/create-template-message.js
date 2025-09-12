const { success, error: errorResponse } = require('../utils/response');
const { createTemplateMessage } = require('../services/template-message-service');

exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return errorResponse({ success: false, message: 'JSON inválido' }, 400, event);
    }

    const { account_id, name, message_text } = body;

    if (!account_id || !name || !message_text) {
      return errorResponse({ success: false, message: 'Campos obrigatórios: account_id, name, message_text' }, 400, event);
    }

    const created = await createTemplateMessage({ account_id, name, message_text });

    return success({ success: true, data: created }, 201, event);
  } catch (err) {
    console.error('[leadshot/create-template-message] error:', err);
    return errorResponse({ success: false, message: 'Erro ao criar template_message', error: err.message }, 500, event);
  }
};
