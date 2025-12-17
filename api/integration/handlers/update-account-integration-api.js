const { success, error: errorResponse } = require('../utils/response');
const { updateAccountIntegrationApi } = require('../services/account-integration-api-service');

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

    if (body.http_method !== undefined) {
      const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (!allowedMethods.includes(body.http_method)) {
        return errorResponse({ success: false, message: 'http_method inválido' }, 400);
      }
    }

    const updated = await updateAccountIntegrationApi(accountId, integrationApiId, body);

    return success({ success: true, data: updated });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[updateAccountIntegrationApi] Erro:', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar integração de API', error: err.message }, statusCode);
  }
};
