const { getDbConnection } = require('../utils/database');
const { updateStep } = require('../services/conversation-funnel-step-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para atualizar step de funil
 */
exports.handler = async (event) => {
  try {
    const stepId = event?.pathParameters?.stepId;
    if (!stepId) {
      return errorResponse({ success: false, message: 'Parâmetro stepId é obrigatório' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, description, conversation_funnel_id } = body;
    if (name === undefined && description === undefined && conversation_funnel_id === undefined) {
      return errorResponse({ success: false, message: 'Forneça ao menos um campo para atualizar' }, 400);
    }

    const updated = await updateStep(stepId, { name, description, conversation_funnel_id });
    return success({ success: true, message: 'Step atualizado com sucesso', data: updated }, 200);
  } catch (error) {
    if (error?.message === 'Etapa de funil não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao atualizar step de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao atualizar step de funil', error: error.message }, 500);
  }
};
