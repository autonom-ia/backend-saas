const { getDbConnection } = require('../utils/database');
const { getFunnelById } = require('../services/conversation-funnel-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para buscar funil por ID
 */
exports.handler = withCors(async (event) => {
  try {
    const funnelId = event?.pathParameters?.funnelId;
    if (!funnelId) {
      return errorResponse({ success: false, message: 'Parâmetro funnelId é obrigatório' }, 400);
    }

    const item = await getFunnelById(funnelId);
    return success({ success: true, data: item }, 200);
  } catch (error) {
    if (error?.message === 'Funil não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao buscar funil:', error);
    return errorResponse({ success: false, message: 'Erro ao buscar funil', error: error.message }, 500);
  }
});
