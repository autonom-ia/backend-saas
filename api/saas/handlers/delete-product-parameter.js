const { getDbConnection } = require('../utils/database');
const { deleteProductParameter } = require('../services/product-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para remover parâmetro de produto por ID
 */
exports.handler = async (event) => {
  try {
    const parameterId = event?.pathParameters?.parameterId;
    if (!parameterId) {
      return errorResponse({ success: false, message: 'Parâmetro parameterId é obrigatório' }, 400);
    }

    await deleteProductParameter(parameterId);
    return success({ success: true, message: 'Parâmetro removido com sucesso' }, 200);
  } catch (error) {
    if (error?.message === 'Parâmetro não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao remover parâmetro de produto:', error);
    return errorResponse({ success: false, message: 'Erro ao remover parâmetro de produto', error: error.message }, 500);
  }
};
