const { success, error: errorResponse } = require('../utils/response');
const { updateCampaign } = require('../services/campaign-service');

exports.handler = async (event) => {
  try {
    const campaignId = event?.pathParameters?.campaignId;
    if (!campaignId) {
      return errorResponse({ success: false, message: 'campaignId é obrigatório' }, 400, event);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return errorResponse({ success: false, message: 'JSON inválido' }, 400, event);
    }

    const updated = await updateCampaign(campaignId, {
      name: body.name,
      description: body.description,
      template_message_id: body.template_message_id,
      account_id: body.account_id,
      inbox_ids: Array.isArray(body.inbox_ids) ? body.inbox_ids : undefined,
      use_all_inboxes: body.use_all_inboxes,
    });

    if (!updated) {
      return errorResponse({ success: false, message: 'Campanha não encontrada' }, 404, event);
    }

    return success({ success: true, data: updated }, 200, event);
  } catch (err) {
    console.error('[leadshot/update-campaign] error:', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar campanha', error: err.message }, 500, event);
  }
};
