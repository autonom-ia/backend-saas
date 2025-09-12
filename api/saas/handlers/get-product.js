const { getProductById } = require('../services/product-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para buscar um produto pelo ID
 */
exports.handler = withCors(async (event, context) => {
  try {
    const { productId } = event.pathParameters || {};
    
    if (!productId) {
      return errorResponse({
        success: false,
        message: 'ID do produto é obrigatório'
      }, 400, event);
    }
    
    const product = await getProductById(productId);
    
    return success({
      success: true,
      data: product
    }, 200, event);
  } catch (error) {
    console.error(`Erro ao buscar produto: ${error.message}`);
    
    if (error.message === 'Produto não encontrado') {
      return errorResponse({
        success: false,
        message: error.message
      }, 404, event);
    }
    
    return errorResponse({
      success: false,
      message: 'Erro ao buscar produto',
      error: error.message
    }, 500, event);
  }
});
