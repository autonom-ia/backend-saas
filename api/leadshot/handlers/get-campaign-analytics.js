// TODO: implement get-campaign-analytics handler

const { success, error: errorResponse } = require('../utils/response');
const { getCampaignAnalytics } = require('../services/campaign-analytics-service');

exports.handler = async (event) => {
  try {
    const query = event?.queryStringParameters || {};
    const accountId = query.accountId || undefined;
    const campaignId = query.campaignId || undefined;
    const templateMessageId = query.templateMessageId || undefined;

    if (!accountId && !campaignId && !templateMessageId) {
      return errorResponse(
        { success: false, message: 'Pelo menos um filtro deve ser informado: accountId, campaignId ou templateMessageId' },
        400,
        event
      );
    }

    const result = await getCampaignAnalytics({ accountId, campaignId, templateMessageId });

    return success({ success: true, data: result }, 200, event);
  } catch (err) {
    console.error('[leadshot/get-campaign-analytics] error:', err);
    return errorResponse(
      { success: false, message: 'Erro ao obter analytics da campanha', error: err.message },
      500,
      event
    );
  }
};
