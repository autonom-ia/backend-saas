const { success, error: errorResponse } = require('../utils/response');
const { updateAccountIntegrationApiStatus } = require('../services/account-integration-api-service');

exports.handler = async (event) => {
  try {
    const accountId = event.pathParameters && event.pathParameters.accountId;
    const integrationApiId = event.pathParameters && event.pathParameters.integrationApiId;

    if (!accountId || !integrationApiId) {
      return errorResponse({ success: false, message: 'accountId e integrationApiId são obrigatórios' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    if (body.is_active === undefined) {
      return errorResponse({ success: false, message: 'is_active é obrigatório' }, 400);
    }

    const updated = await updateAccountIntegrationApiStatus(accountId, integrationApiId, body.is_active);

    return success({ success: true, data: updated });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[updateAccountIntegrationApiStatus] Erro:', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar status da integração de API', error: err.message }, statusCode);
  }
};
