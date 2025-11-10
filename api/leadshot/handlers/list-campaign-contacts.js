const { listCampaignContacts, getCampaignById } = require('../services/campaign-import-service');
const { success, error: errorResponse } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar contatos de uma campanha
 */
exports.handler = withCors(async (event, context) => {
  try {
    const campaignId = event.pathParameters?.campaignId;
    
    if (!campaignId) {
      return errorResponse({ 
        success: false, 
        message: 'ID da campanha é obrigatório' 
      }, 400, event);
    }

    // Extrair parâmetros de query
    const queryParams = event.queryStringParameters || {};
    const { status, limit, offset } = queryParams;

    // Extrair email do usuário autenticado via Cognito Authorizer
    const claims = event?.requestContext?.authorizer?.claims || event?.requestContext?.authorizer?.jwt?.claims || {};
    const email = claims.email || claims['cognito:username'] || null;

    if (!email) {
      return errorResponse({ success: false, message: 'Não autenticado' }, 401, event);
    }

    // Buscar usuário no banco para obter id
    const knex = getDbConnection();
    const user = await knex('users').where({ email }).first();

    if (!user) {
      return errorResponse({ success: false, message: 'Usuário não encontrado' }, 404, event);
    }

    // Verificar se o usuário tem acesso à campanha através das contas
    const userAccounts = await knex('user_accounts')
      .where({ user_id: user.id })
      .pluck('account_id');

    if (userAccounts.length === 0) {
      return errorResponse({ 
        success: false, 
        message: 'Usuário não possui acesso a nenhuma conta' 
      }, 403, event);
    }

    // Verificar se a campanha pertence a uma das contas do usuário
    const campaign = await knex('campaign')
      .where({ id: campaignId })
      .whereIn('account_id', userAccounts)
      .first();

    if (!campaign) {
      return errorResponse({ 
        success: false, 
        message: 'Campanha não encontrada ou acesso negado' 
      }, 404, event);
    }

    // Buscar contatos da campanha
    const filters = {};
    if (status) filters.status = status;
    if (limit) filters.limit = limit;
    if (offset) filters.offset = offset;

    const result = await listCampaignContacts(campaignId, filters);
    
    return success({
      success: true,
      data: result.data,
      total: result.total,
      campaign: {
        id: campaign.id,
        name: campaign.name
      }
    }, 200, event);

  } catch (error) {
    console.error('Erro ao listar contatos da campanha:', error);
    
    return errorResponse({
      success: false,
      message: 'Erro ao listar contatos da campanha',
      error: error.message
    }, 500, event);
  }
});
