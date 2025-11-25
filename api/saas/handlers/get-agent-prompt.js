const { getPromptById } = require('../services/agent-prompt-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para buscar um prompt do agente pelo ID
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
    
    const prompt = await getPromptById(promptId);
    
    return success({
      success: true,
      data: prompt
    }, 200, event);
  } catch (error) {
    console.error(`Erro ao buscar prompt: ${error.message}`);
    
    if (error.message === 'Prompt não encontrado') {
      return errorResponse({
        success: false,
        message: error.message
      }, 404, event);
    }
    
    return errorResponse({
      success: false,
      message: 'Erro ao buscar prompt',
      error: error.message
    }, 500, event);
  }
});

