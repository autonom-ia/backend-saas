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
    
    const { name, description, product_type_id } = requestBody;
    
    // Validação dos campos obrigatórios
    if (!name) {
      return errorResponse({
        success: false,
        message: 'Nome do produto é obrigatório'
      }, 400);
    }
    
    // description opcional
    
    const newProduct = await createProduct({
      name,
      description,
      product_type_id
    });

    // Criar parâmetros para o novo produto baseado nos padrões (product_parameters_standard)
    try {
      const knex = getDbConnection();
      const standardParams = await knex('product_parameters_standard')
        .select('name', 'short_description', 'help_text', 'default_value')
        .orderBy('name', 'asc');
      
      if (standardParams.length > 0) {
        const seedRows = standardParams.map(param => ({
          name: param.name,
          value: param.default_value || '',
          product_id: newProduct.id,
          short_description: param.short_description,
          help_text: param.help_text,
          default_value: param.default_value
        }));
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
