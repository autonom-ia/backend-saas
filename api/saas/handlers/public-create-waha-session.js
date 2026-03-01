const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { createInternalSession } = require('../services/waha-service-client');

// Endpoint público chamado pelo portal via link de conexão da inbox.
// Recebe os dados necessários (accountId, inboxId, token) diretamente do frontend
// e cria a sessão WAHA via endpoint interno protegido por x-internal-token.

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

    await createInternalSession({ accountId, inboxId });

    return success({ success: true }, 201, event);
  } catch (err) {
    console.error('Erro ao criar sessão WAHA pública via SaaS:', {
      message: err && err.message,
      statusCode: err && err.statusCode,
      body: err && err.body,
    });

    const statusCode = err && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;

    return errorResponse(
      {
        success: false,
        message: 'Erro ao criar sessão do WhatsApp',
        error: err && err.message,
      },
      statusCode,
      event,
    );
  }
});
