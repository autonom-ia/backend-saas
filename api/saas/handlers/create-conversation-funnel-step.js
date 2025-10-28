const { getDbConnection } = require('../utils/database');
const { createStep } = require('../services/conversation-funnel-step-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para criar step de funil
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, description, conversation_funnel_id, agent_instruction, order } = body;
    if (!name || !description || !conversation_funnel_id) {
      return errorResponse({ success: false, message: 'Campos obrigatórios: name, description, conversation_funnel_id' }, 400);
    }

    const created = await createStep({ name, description, conversation_funnel_id, agent_instruction, order });
    return success({ success: true, message: 'Step criado com sucesso', data: created }, 201);
  } catch (error) {
    console.error('Erro ao criar step de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao criar step de funil', error: error.message }, 500);
  }
};
