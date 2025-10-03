const { processN8nWebhook } = require('../services/campaign-import-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para webhook do n8n
 * Este endpoint não requer autenticação pois é chamado pelo n8n
 */
exports.handler = withCors(async (event, context) => {
  try {
    // Parse do body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse({ 
        success: false, 
        message: 'Body da requisição deve ser um JSON válido' 
      }, 400, event);
    }

    // Validar dados obrigatórios
    const { action } = body;

    if (!action) {
      return errorResponse({ 
        success: false, 
        message: 'Action é obrigatório' 
      }, 400, event);
    }

    // Log do webhook recebido
    console.log('Webhook n8n recebido:', JSON.stringify(body, null, 2));

    // Processar webhook
    const result = await processN8nWebhook(body);
    
    return success(result, 200, event);

  } catch (error) {
    console.error('Erro ao processar webhook n8n:', error);
    
    return errorResponse({
      success: false,
      message: 'Erro ao processar webhook',
      error: error.message
    }, 500, event);
  }
});
