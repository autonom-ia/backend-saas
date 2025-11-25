const { reactivatePrompt } = require('../services/agent-prompt-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para reativar um prompt do agente
 */
exports.handler = withCors(async (event) => {
  try {
    const { promptId } = event.pathParameters || {};
    
    if (!promptId) {
      return errorResponse({
        success: false,
        message: 'ID do prompt é obrigatório'
      }, 400, event);
    }
    
    const reactivatedPrompt = await reactivatePrompt(promptId);
    
    return success({
      success: true,
      message: 'Prompt reativado com sucesso',
      data: reactivatedPrompt
    }, 200, event);
  } catch (error) {
    console.error(`Erro ao reativar prompt: ${error.message}`);
    
    if (error.message === 'Prompt não encontrado' || error.message === 'Prompt já está ativo') {
      return errorResponse({
        success: false,
        message: error.message
      }, 400, event);
    }
    
    return errorResponse({
      success: false,
      message: 'Erro ao reativar prompt',
      error: error.message
    }, 500, event);
  }
});

