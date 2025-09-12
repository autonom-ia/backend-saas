const { success, error: errorResponse } = require('../utils/response');
const { createMessageLog } = require('../services/message-log-service');

exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return errorResponse({ success: false, message: 'JSON inválido' }, 400, event);
    }

    const { campaign_id, user_session_id, phone_number, success: ok, error } = body;

    if (!campaign_id) {
      return errorResponse({ success: false, message: 'Campo obrigatório: campaign_id' }, 400, event);
    }

    const created = await createMessageLog({
      campaign_id,
      user_session_id: user_session_id || null,
      phone_number: phone_number || null,
      success: typeof ok === 'boolean' ? ok : false,
      error: error || null,
    });

    return success({ success: true, data: created }, 201, event);
  } catch (err) {
    console.error('[leadshot/create-message-log] error:', err);
    return errorResponse({ success: false, message: 'Erro ao criar message_logs', error: err.message }, 500, event);
  }
};
