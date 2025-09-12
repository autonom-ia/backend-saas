const { getDbConnection } = require('../utils/database');
const { updateMessage } = require('../services/conversation-funnel-step-message-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para atualizar mensagem de step de funil
 */
exports.handler = async (event) => {
  try {
    const messageId = event?.pathParameters?.messageId;
    if (!messageId) {
      return errorResponse({ success: false, message: 'Parâmetro messageId é obrigatório' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, description, conversation_funnel_step_id, shipping_time, shipping_order, message_instruction, fixed_message } = body;
    if (
      name === undefined &&
      description === undefined &&
      conversation_funnel_step_id === undefined &&
      shipping_time === undefined &&
      shipping_order === undefined &&
      message_instruction === undefined &&
      fixed_message === undefined
    ) {
      return errorResponse({ success: false, message: 'Forneça ao menos um campo para atualizar' }, 400);
    }

    const updated = await updateMessage(messageId, { name, description, conversation_funnel_step_id, shipping_time, shipping_order, message_instruction, fixed_message });
    return success({ success: true, message: 'Mensagem atualizada com sucesso', data: updated }, 200);
  } catch (error) {
    if (error?.message === 'Mensagem de etapa não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao atualizar mensagem de step de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao atualizar mensagem de step de funil', error: error.message }, 500);
  }
};
