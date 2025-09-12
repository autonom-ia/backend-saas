const { success, error: errorResponse } = require('../utils/response');
const { createCampaign } = require('../services/campaign-service');

exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return errorResponse({ success: false, message: 'JSON inválido' }, 400, event);
    }

    const { name, description, template_message_id, account_id } = body || {};

    if (!name || !account_id) {
      return errorResponse({ success: false, message: 'Campos obrigatórios: name, account_id' }, 400, event);
    }

    const created = await createCampaign({ name, description: description || null, template_message_id: template_message_id || null, account_id });

    return success({ success: true, data: created }, 201, event);
  } catch (err) {
    console.error('[leadshot/create-campaign] error:', err);
    return errorResponse({ success: false, message: 'Erro ao criar campanha', error: err.message }, 500, event);
  }
};
