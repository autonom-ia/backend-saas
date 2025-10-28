const { listProductTypes } = require('../services/product-type-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

exports.handler = withCors(async (event) => {
  try {
    const rows = await listProductTypes();
    return success({ success: true, data: rows }, 200, event);
  } catch (error) {
    console.error('Erro ao listar tipos de produto:', error);
    return errorResponse({ success: false, message: 'Erro ao listar tipos de produto', error: error.message }, 500, event);
  }
});
