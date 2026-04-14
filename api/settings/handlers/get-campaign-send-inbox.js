const { success, error } = require('../utils/response');
const { getDbConnection, closeDbConnection } = require('../utils/database');
const { getInboxLongestWithoutSend } = require('../services/campaign-inbox-service');
const { requireInternalToken } = require('../utils/internal-auth');

module.exports.handler = async (event) => {
  let db;

  try {
    requireInternalToken(event);

    const body = JSON.parse(event.body || '{}');
    const campaignId = body.campaign_id || body.campaignId;

    if (!campaignId) {
      return error('Campo campaign_id é obrigatório no corpo da requisição', 400);
    }

    db = getDbConnection();

    const campaignInbox = await getInboxLongestWithoutSend({
      db,
      campaignId,
    });

    if (!campaignInbox) {
      return error('Campanha ou caixa de entrada não encontrada', 404);
    }

    return success({
      message: 'Caixa de entrada selecionada com sucesso',
      data: campaignInbox,
    });
  } catch (err) {
    console.error('[get-campaign-send-inbox] Erro ao selecionar caixa de entrada', err);

    const statusCode = err.statusCode || 500;
    return error(err.message || 'Erro interno ao selecionar caixa de entrada', statusCode);
  } finally {
    if (db) {
      await closeDbConnection();
    }
  }
};
