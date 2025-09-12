const { getDbConnection } = require('../utils/database');
const { updateFunnel } = require('../services/conversation-funnel-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para atualizar funil de conversação
 */
exports.handler = async (event) => {
  try {
    const funnelId = event?.pathParameters?.funnelId;
    if (!funnelId) {
      return errorResponse({ success: false, message: 'Parâmetro funnelId é obrigatório' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, description, is_default } = body;
    if (name === undefined && description === undefined && is_default === undefined) {
      return errorResponse({ success: false, message: 'Forneça ao menos um campo para atualizar' }, 400);
    }

    const updated = await updateFunnel(funnelId, { name, description, is_default });
    return success({ success: true, message: 'Funil atualizado com sucesso', data: updated }, 200);
  } catch (error) {
    if (error?.message === 'Funil não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao atualizar funil:', error);
    return errorResponse({ success: false, message: 'Erro ao atualizar funil', error: error.message }, 500);
  }
};

