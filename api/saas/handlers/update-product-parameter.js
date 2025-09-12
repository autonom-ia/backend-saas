const { getDbConnection } = require('../utils/database');
const { updateProductParameter } = require('../services/product-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para atualizar parâmetro de produto
 */
exports.handler = async (event) => {
  try {
    const parameterId = event?.pathParameters?.parameterId;
    if (!parameterId) {
      return errorResponse({ success: false, message: 'Parâmetro parameterId é obrigatório' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, value, product_id } = body;
    if (name === undefined && value === undefined && product_id === undefined) {
      return errorResponse({ success: false, message: 'Forneça ao menos um campo para atualizar' }, 400);
    }

    const updated = await updateProductParameter(parameterId, { name, value, product_id });
    return success({ success: true, message: 'Parâmetro atualizado com sucesso', data: updated }, 200);
  } catch (error) {
    if (error?.message === 'Parâmetro não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao atualizar parâmetro de produto:', error);
    return errorResponse({ success: false, message: 'Erro ao atualizar parâmetro de produto', error: error.message }, 500);
  }
};
