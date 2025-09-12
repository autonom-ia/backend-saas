const { success, error: errorResponse } = require('../utils/response');
const { updateTemplateMessage } = require('../services/template-message-service');

exports.handler = async (event) => {
  try {
    const id = event?.pathParameters?.templateMessageId;
    if (!id) {
      return errorResponse({ success: false, message: 'templateMessageId é obrigatório' }, 400, event);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return errorResponse({ success: false, message: 'JSON inválido' }, 400, event);
    }

    const { name, message_text } = body;
    if (typeof name !== 'string' && typeof message_text !== 'string') {
      return errorResponse({ success: false, message: 'Informe pelo menos um campo: name ou message_text' }, 400, event);
    }

    const updated = await updateTemplateMessage(id, { name, message_text });
    if (!updated) {
      return errorResponse({ success: false, message: 'Template não encontrado' }, 404, event);
    }

    return success({ success: true, data: updated }, 200, event);
  } catch (err) {
    console.error('[leadshot/update-template-message] error:', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar template_message', error: err.message }, 500, event);
  }
};
