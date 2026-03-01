const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getInternalConnectionState } = require('../services/waha-service-client');

exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const inboxId = pathParams.inboxId;

    if (!inboxId) {
      return errorResponse({ success: false, message: 'Parâmetro inboxId é obrigatório' }, 400, event);
    }

    const qs = event.queryStringParameters || {};
    const token = qs.token;
    const accountId = qs.accountId;

    if (!token) {
      return errorResponse({ success: false, message: 'Token de conexão é obrigatório' }, 400, event);
    }

    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400, event);
    }

    const state = await getInternalConnectionState({
      accountId,
      inboxId,
    });

    return success({ success: true, data: state }, 200, event);
  } catch (err) {
    console.error('Erro ao buscar estado de conexão WAHA pública via SaaS:', {
      message: err && err.message,
      statusCode: err && err.statusCode,
      body: err && err.body,
    });

    const statusCode = err && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;

    return errorResponse(
      {
        success: false,
        message: 'Erro ao buscar estado da conexão do WhatsApp',
        error: err && err.message,
      },
      statusCode,
      event,
    );
  }
});
