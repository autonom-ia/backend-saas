const { success, error: errorResponse } = require('../utils/response');
const { getTemplateMessage } = require('../services/template-message-service');

exports.handler = async (event) => {
  try {
    const id = event?.pathParameters?.templateMessageId;
    if (!id) {
      return errorResponse({ success: false, message: 'templateMessageId é obrigatório' }, 400, event);
    }
    const row = await getTemplateMessage(id);
    if (!row) {
      return errorResponse({ success: false, message: 'Template não encontrado' }, 404, event);
    }
    return success({ success: true, data: row }, 200, event);
  } catch (err) {
    console.error('[leadshot/get-template-message] error:', err);
    return errorResponse({ success: false, message: 'Erro ao buscar template_message', error: err.message }, 500, event);
  }
};
