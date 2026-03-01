const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { syncInternalWhatsappEnvironment } = require('../services/waha-service-client');

exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const inboxId = pathParams.inboxId;

    if (!inboxId) {
      return errorResponse({ success: false, message: 'Parâmetro inboxId é obrigatório' }, 400, event);
    }

    const body = JSON.parse(event.body || '{}');
    const token = body.token;
    const accountId = body.accountId;

    if (!token) {
      return errorResponse({ success: false, message: 'Token de conexão é obrigatório' }, 400, event);
    }

    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400, event);
    }

    await syncInternalWhatsappEnvironment({
      accountId,
      inboxId,
    });

    return success({ success: true }, 200, event);
  } catch (err) {
    console.error('Erro ao sincronizar ambiente WhatsApp público via SaaS:', {
      message: err && err.message,
      statusCode: err && err.statusCode,
      body: err && err.body,
    });

    const statusCode = err && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;

    return errorResponse(
      {
        success: false,
        message: 'Erro ao sincronizar ambiente do WhatsApp',
        error: err && err.message,
      },
      statusCode,
      event,
    );
  }
});
