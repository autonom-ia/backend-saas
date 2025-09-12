const { getDbConnection } = require('../utils/database');
const { createMessage } = require('../services/conversation-funnel-step-message-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para criar mensagem de step de funil
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, description, conversation_funnel_step_id, shipping_time, shipping_order, message_instruction, fixed_message } = body;
    if (!name || !description || !conversation_funnel_step_id) {
      return errorResponse({ success: false, message: 'Campos obrigatórios: name, description, conversation_funnel_step_id' }, 400);
    }

    const created = await createMessage({
      name,
      description,
      conversation_funnel_step_id,
      shipping_time,
      shipping_order,
      message_instruction,
      fixed_message,
    });
    return success({ success: true, message: 'Mensagem criada com sucesso', data: created }, 201);
  } catch (error) {
    console.error('Erro ao criar mensagem de step de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao criar mensagem de step de funil', error: error.message }, 500);
  }
};
