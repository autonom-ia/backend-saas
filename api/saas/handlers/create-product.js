const { createProduct } = require('../services/product-service');
const { getDbConnection } = require('../utils/database');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para criar um novo produto
 */
exports.handler = async (event, context) => {
  try {
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return errorResponse({
        success: false,
        message: 'Corpo da requisição inválido'
      }, 400);
    }
    
    const { name, description } = requestBody;
    
    // Validação dos campos obrigatórios
    if (!name) {
      return errorResponse({
        success: false,
        message: 'Nome do produto é obrigatório'
      }, 400);
    }
    
    if (!description) {
      return errorResponse({
        success: false,
        message: 'Descrição do produto é obrigatória'
      }, 400);
    }
    
    const newProduct = await createProduct({
      name,
      description
    });

    // Clonar parâmetros base de produto (distinct name) com value = '' para o novo produto
    try {
      const knex = getDbConnection();
      const distinctNames = await knex('product_parameter').distinct('name');
      const names = distinctNames
        .map(r => r.name)
        .filter(n => typeof n === 'string' && n.trim().length > 0);
      if (names.length > 0) {
        const seedRows = names.map(name => ({ name, value: '', product_id: newProduct.id }));
        await knex('product_parameter').insert(seedRows);
      }
    } catch (seedErr) {
      console.error('[create-product] Falha ao semear product_parameter para o novo produto:', seedErr?.message || seedErr);
      // Não interrompe a criação do produto
    }
    
    return success({
      success: true,
      message: 'Produto criado com sucesso',
      data: newProduct
    }, 201);
  } catch (error) {
    console.error(`Erro ao criar produto: ${error.message}`);
    
    return errorResponse({
      success: false,
      message: 'Erro ao criar produto',
      error: error.message
    }, 500);
  }
};
