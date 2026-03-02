const { listCampaignContacts, getCampaignById } = require('../services/campaign-import-service');
const { success, error: errorResponse } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar contatos de uma campanha
 */
exports.handler = withCors(async (event, context) => {
  try {
    console.log('[list-campaign-contacts] Evento recebido:', JSON.stringify(event));

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

    console.log('[list-campaign-contacts] Parâmetros de entrada', {
      campaignId,
      status,
      limit,
      offset,
    });

    // Buscar campanha apenas pelo ID (sem validação de contas do usuário)
    const knex = getDbConnection();
    const campaign = await knex('campaign')
      .where({ id: campaignId })
      .first();

    console.log('[list-campaign-contacts] Campanha encontrada?', {
      campaignExists: Boolean(campaign),
      campaignId,
    });

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

    console.log('[list-campaign-contacts] Filtros aplicados', filters);

    const result = await listCampaignContacts(campaignId, filters);

    console.log('[list-campaign-contacts] Resultado da consulta', {
      total: result?.total,
      dataLength: Array.isArray(result?.data) ? result.data.length : null,
    });
    
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
