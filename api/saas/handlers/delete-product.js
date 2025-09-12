const { deleteProduct } = require('../services/product-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para remover um produto pelo ID
 */
exports.handler = async (event, context) => {
  try {
    const { productId } = event.pathParameters || {};
    
    if (!productId) {
      return errorResponse({
        success: false,
        message: 'ID do produto é obrigatório'
      }, 400);
    }
    
    await deleteProduct(productId);
    
    return success({
      success: true,
      message: 'Produto removido com sucesso'
    }, 200);
  } catch (error) {
    console.error(`Erro ao remover produto: ${error.message}`);
    
    if (error.message === 'Produto não encontrado') {
      return errorResponse({
        success: false,
        message: error.message
      }, 404);
    }
    
    return errorResponse({
      success: false,
      message: 'Erro ao remover produto',
      error: error.message
    }, 500);
  }
};
