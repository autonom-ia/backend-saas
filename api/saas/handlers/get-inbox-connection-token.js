const { getInboxById } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getCache } = require('../utils/cache');

exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const token = pathParams.token;

    if (!token) {
      return errorResponse({ success: false, message: 'Parâmetro token é obrigatório' }, 400, event);
    }

    const cacheKey = `inbox-connection:${token}`;
    const data = await getCache(cacheKey);

    if (!data || !data.inbox_id || !data.account_id) {
      return errorResponse({ success: false, message: 'Token inválido ou expirado' }, 404, event);
    }

    const inbox = await getInboxById(data.inbox_id);

    return success({
      success: true,
      data: {
        token,
        account_id: inbox.account_id,
        inbox_id: inbox.id,
        inbox_name: inbox.name,
        contact_name: inbox.contact_name || null,
        notification_email: inbox.notification_email || null,
      },
    }, 200, event);
  } catch (err) {
    console.error('Erro ao validar token de conexão da inbox:', err);
    return errorResponse({ success: false, message: 'Erro ao validar token de conexão', error: err.message }, 500, event);
  }
});
