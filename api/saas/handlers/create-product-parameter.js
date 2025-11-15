const { getDbConnection } = require('../utils/database');
const { createProductParameter } = require('../services/product-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para criar parâmetro de produto
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, value, product_id, short_description, help_text, default_value } = body;
    if (!name || !product_id) {
      return errorResponse({ success: false, message: 'Campos obrigatórios: name, product_id' }, 400);
    }

    const created = await createProductParameter({ 
      name, 
      value, 
      product_id, 
      short_description, 
      help_text, 
      default_value 
    });
    return success({ success: true, message: 'Parâmetro criado com sucesso', data: created }, 201);
  } catch (error) {
    console.error('Erro ao criar parâmetro de produto:', error);
    return errorResponse({ success: false, message: 'Erro ao criar parâmetro de produto', error: error.message }, 500);
  }
};
