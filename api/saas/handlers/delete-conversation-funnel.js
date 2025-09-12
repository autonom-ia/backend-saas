const { getDbConnection } = require('../utils/database');
const { deleteFunnel } = require('../services/conversation-funnel-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para remover funil por ID
 */
exports.handler = async (event) => {
  try {
    const funnelId = event?.pathParameters?.funnelId;
    if (!funnelId) {
      return errorResponse({ success: false, message: 'Parâmetro funnelId é obrigatório' }, 400);
    }

    await deleteFunnel(funnelId);
    return success({ success: true, message: 'Funil removido com sucesso' }, 200);
  } catch (error) {
    if (error?.message === 'Funil não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao remover funil:', error);
    return errorResponse({ success: false, message: 'Erro ao remover funil', error: error.message }, 500);
  }
};
