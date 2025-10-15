const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

/**
 * Handler para listar campanhas
 */
exports.handler = withCors(async (event) => {
  try {
    const accountId = event?.queryStringParameters?.accountId;

    const db = getDbConnection();
    let query = db('campaign')
      .select(
        'campaign.*',
        'account.social_name as account_name',
        'account.email as account_email',
        'template_message.name as template_name',
        'template_message.message_text as template_text'
      )
      .leftJoin('account', 'campaign.account_id', 'account.id')
      .leftJoin('template_message', 'campaign.template_message_id', 'template_message.id')
      .orderBy('campaign.created_at', 'desc');

    // Filtrar por conta se fornecido
    if (accountId) {
      query = query.where('campaign.account_id', accountId);
    }

    const campaigns = await query;

    console.log(`Encontradas ${campaigns.length} campanhas`);

    return success({
      success: true,
      data: campaigns
    }, 200, event);

  } catch (error) {
    console.error('Erro ao listar campanhas:', error);
    return errorResponse({
      success: false,
      message: 'Erro ao listar campanhas',
      error: error.message
    }, 500, event);
  }
});
