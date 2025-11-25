const { createPrompt } = require('../services/agent-prompt-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para criar um prompt do agente
 */
exports.handler = withCors(async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400, event);
    }

    const { product_id, title, code, content } = body;
    if (!product_id || !title || !code || !content) {
      return errorResponse({ 
        success: false, 
        message: 'Campos obrigatórios: product_id, title, code, content' 
      }, 400, event);
    }

    const created = await createPrompt({ 
      product_id, 
      title, 
      code, 
      content 
    });
    return success({ success: true, message: 'Prompt criado com sucesso', data: created }, 201, event);
  } catch (error) {
    console.error('Erro ao criar prompt do agente:', error);
    
    if (error.message.includes('Já existe um prompt com o código')) {
      return errorResponse({ 
        success: false, 
        message: error.message 
      }, 409, event);
    }
    
    return errorResponse({ 
      success: false, 
      message: 'Erro ao criar prompt do agente', 
      error: error.message 
    }, 500, event);
  }
});

