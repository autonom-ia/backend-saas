const { getDbConnection } = require('../utils/database');
const { getAllProductParameters } = require('../services/product-parameter-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar parâmetros de produto filtrados por productId (querystring)
 */
exports.handler = withCors(async (event) => {
  try {
    const productId = event?.queryStringParameters?.productId;
    if (!productId) {
      return errorResponse({ success: false, message: 'Parâmetro productId é obrigatório' }, 400, event);
    }
    const items = await getAllProductParameters(productId);
    return success({ success: true, data: items }, 200, event);
  } catch (error) {
    console.error('Erro ao listar parâmetros de produto:', error);
    return errorResponse({ success: false, message: 'Erro ao listar parâmetros de produto', error: error.message }, 500, event);
  }
});
