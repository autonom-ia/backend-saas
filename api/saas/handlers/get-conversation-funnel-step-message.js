const { getDbConnection } = require('../utils/database');
const { getMessageById } = require('../services/conversation-funnel-step-message-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para buscar mensagem de step de funil por ID
 */
exports.handler = async (event) => {
  try {
    const messageId = event?.pathParameters?.messageId;
    if (!messageId) {
      return errorResponse({ success: false, message: 'Parâmetro messageId é obrigatório' }, 400);
    }

    const item = await getMessageById(messageId);
    return success({ success: true, data: item }, 200);
  } catch (error) {
    if (error?.message === 'Mensagem de etapa não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao buscar mensagem de step de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao buscar mensagem de step de funil', error: error.message }, 500);
  }
};
