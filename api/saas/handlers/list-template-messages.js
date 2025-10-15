const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

/**
 * Handler para listar templates de mensagem
 */
exports.handler = withCors(async (event) => {
  try {
    const accountId = event?.queryStringParameters?.accountId;

    if (!accountId) {
      return errorResponse({
        success: false,
        message: 'Parâmetro accountId é obrigatório'
      }, 400, event);
    }

    const db = getDbConnection();
    
    const templates = await db('template_message')
      .select(
        'template_message.*',
        'account.social_name as account_name',
        'account.email as account_email'
      )
      .leftJoin('account', 'template_message.account_id', 'account.id')
      .where('template_message.account_id', accountId)
      .orderBy('template_message.created_at', 'desc');

    console.log(`Encontrados ${templates.length} templates para conta ${accountId}`);

    return success({
      success: true,
      data: templates
    }, 200, event);

  } catch (error) {
    console.error('Erro ao listar templates de mensagem:', error);
    return errorResponse({
      success: false,
      message: 'Erro ao listar templates de mensagem',
      error: error.message
    }, 500, event);
  }
});
