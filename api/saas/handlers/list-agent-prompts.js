const { getPromptsByProductId, getPromptsHistoryByProductId } = require('../services/agent-prompt-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar prompts do agente filtrados por productId (querystring)
 * Query params:
 * - productId: obrigatório
 * - includeInactive: se true, inclui prompts inativos (mas não deletados)
 * - history: se true, retorna histórico completo (incluindo deletados)
 */
exports.handler = withCors(async (event) => {
  try {
    const productId = event?.queryStringParameters?.productId;
    const includeInactive = event?.queryStringParameters?.includeInactive === 'true';
    const history = event?.queryStringParameters?.history === 'true';
    
    if (!productId) {
      return errorResponse({ success: false, message: 'Parâmetro productId é obrigatório' }, 400, event);
    }
    
    let items;
    if (history) {
      items = await getPromptsHistoryByProductId(productId);
    } else {
      items = await getPromptsByProductId(productId, includeInactive);
    }
    
    return success({ success: true, data: items }, 200, event);
  } catch (error) {
    console.error('Erro ao listar prompts do agente:', error);
    return errorResponse({ success: false, message: 'Erro ao listar prompts do agente', error: error.message }, 500, event);
  }
});

