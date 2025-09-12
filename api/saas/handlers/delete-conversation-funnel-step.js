const { getDbConnection } = require('../utils/database');
const { deleteStep } = require('../services/conversation-funnel-step-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para remover step de funil por ID
 */
exports.handler = async (event) => {
  try {
    const stepId = event?.pathParameters?.stepId;
    if (!stepId) {
      return errorResponse({ success: false, message: 'Parâmetro stepId é obrigatório' }, 400);
    }

    await deleteStep(stepId);
    return success({ success: true, message: 'Step removido com sucesso' }, 200);
  } catch (error) {
    if (error?.message === 'Etapa de funil não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao remover step de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao remover step de funil', error: error.message }, 500);
  }
};
