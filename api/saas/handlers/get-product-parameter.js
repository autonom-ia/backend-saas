const { getDbConnection } = require('../utils/database');
const { getProductParameterById } = require('../services/product-parameter-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para buscar parâmetro de produto por ID
 */
exports.handler = withCors(async (event) => {
  try {
    const parameterId = event?.pathParameters?.parameterId;
    if (!parameterId) {
      return errorResponse({ success: false, message: 'Parâmetro parameterId é obrigatório' }, 400, event);
    }

    const item = await getProductParameterById(parameterId);
    return success({ success: true, data: item }, 200, event);
  } catch (error) {
    if (error?.message === 'Parâmetro não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404, event);
    }
    console.error('Erro ao buscar parâmetro de produto:', error);
    return errorResponse({ success: false, message: 'Erro ao buscar parâmetro de produto', error: error.message }, 500, event);
  }
});
