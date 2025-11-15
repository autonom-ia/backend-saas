const { getDbConnection } = require('../utils/database');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para buscar parâmetros de uma conta específica
 * Retorna apenas os parâmetros cujo standard tem visible_onboarding = true
 * Faz JOIN entre account_parameter e account_parameters_standard pelo name
 */
exports.handler = async (event) => {
  try {
    const accountId = event?.pathParameters?.accountId;
    
    if (!accountId) {
      return errorResponse({ success: false, message: 'accountId é obrigatório' }, 400);
    }

    const knex = getDbConnection();
    
    // JOIN entre account_parameter e account_parameters_standard
    // Retorna apenas parâmetros onde standard.visible_onboarding = true
    const parameters = await knex('account_parameter as ap')
      .select(
        'ap.id',
        'ap.name',
        'ap.value',
        'ap.short_description',
        'ap.help_text',
        'ap.default_value',
        'aps.visible_onboarding'
      )
      .leftJoin('account_parameters_standard as aps', 'ap.name', 'aps.name')
      .where('ap.account_id', accountId)
      .andWhere('aps.visible_onboarding', true)
      .orderBy([
        { column: 'ap.short_description', order: 'asc', nulls: 'last' },
        { column: 'ap.name', order: 'asc' }
      ]);

    return success({ success: true, data: parameters }, 200);
  } catch (error) {
    console.error('Erro ao buscar parâmetros da conta para onboarding:', error);
    return errorResponse({ 
      success: false, 
      message: 'Erro ao buscar parâmetros da conta para onboarding', 
      error: error.message 
    }, 500);
  }
};
