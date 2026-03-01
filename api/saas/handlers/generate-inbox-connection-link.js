const { getInboxById } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { setCache } = require('../utils/cache');
const { randomUUID } = require('crypto');

const TOKEN_TTL_SECONDS = 3600; // 1 hora

exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const inboxId = pathParams.inboxId;

    if (!inboxId) {
      return errorResponse({ success: false, message: 'Parâmetro inboxId é obrigatório' }, 400, event);
    }

    const inbox = await getInboxById(inboxId);
    const token = randomUUID();

    const payload = {
      token,
      inbox_id: inbox.id,
      account_id: inbox.account_id,
      inbox_name: inbox.name,
      contact_name: inbox.contact_name || null,
      notification_email: inbox.notification_email || null,
      created_at: new Date().toISOString(),
      expires_in_seconds: TOKEN_TTL_SECONDS,
    };

    const cacheKey = `inbox-connection:${token}`;
    await setCache(cacheKey, payload, TOKEN_TTL_SECONDS);

    return success({ success: true, data: { token } }, 201, event);
  } catch (err) {
    console.error('Erro ao gerar token de conexão para inbox:', err);
    return errorResponse({ success: false, message: 'Erro ao gerar token de conexão', error: err.message }, 500, event);
  }
});
