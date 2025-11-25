const { getAllStandardPrompts } = require('../services/agent-prompt-standard-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar todos os prompts padrão
 */
exports.handler = withCors(async (event) => {
  try {
    const items = await getAllStandardPrompts();
    return success({ success: true, data: items }, 200, event);
  } catch (error) {
    console.error('Erro ao listar prompts padrão:', error);
    return errorResponse({ success: false, message: 'Erro ao listar prompts padrão', error: error.message }, 500, event);
  }
});

