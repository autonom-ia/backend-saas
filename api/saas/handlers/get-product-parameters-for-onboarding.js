const { getDbConnection } = require('../utils/database');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para buscar parâmetros de um produto específico
 * Retorna apenas os parâmetros cujo standard tem visible_onboarding = true
 * Faz JOIN entre product_parameter e product_parameters_standard pelo name
 */
exports.handler = async (event) => {
  try {
    const productId = event?.pathParameters?.productId;
    
    if (!productId) {
      return errorResponse({ success: false, message: 'productId é obrigatório' }, 400);
    }

    const knex = getDbConnection();
    
    // JOIN entre product_parameter e product_parameters_standard
    // Retorna apenas parâmetros onde standard.visible_onboarding = true
    const parameters = await knex('product_parameter as pp')
      .select(
        'pp.id',
        'pp.name',
        'pp.value',
        'pp.short_description',
        'pp.help_text',
        'pp.default_value',
        'pps.visible_onboarding'
      )
      .leftJoin('product_parameters_standard as pps', 'pp.name', 'pps.name')
      .where('pp.product_id', productId)
      .andWhere('pps.visible_onboarding', true)
      .orderBy([
        { column: 'pp.short_description', order: 'asc', nulls: 'last' },
        { column: 'pp.name', order: 'asc' }
      ]);

    return success({ success: true, data: parameters }, 200);
  } catch (error) {
    console.error('Erro ao buscar parâmetros do produto para onboarding:', error);
    return errorResponse({ 
      success: false, 
      message: 'Erro ao buscar parâmetros do produto para onboarding', 
      error: error.message 
    }, 500);
  }
};
