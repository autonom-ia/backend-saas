const { success, error: errorResponse } = require('../utils/response');
const { getAccountIntegrationApiById } = require('../services/account-integration-api-service');

exports.handler = async (event) => {
  try {
    const accountId = event.pathParameters && event.pathParameters.accountId;
    const integrationApiId = event.pathParameters && event.pathParameters.integrationApiId;

    if (!accountId || !integrationApiId) {
      return errorResponse({ success: false, message: 'accountId e integrationApiId são obrigatórios' }, 400);
    }

    const item = await getAccountIntegrationApiById(accountId, integrationApiId);

    return success({ success: true, data: item });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[getAccountIntegrationApi] Erro:', err);
    return errorResponse({ success: false, message: 'Erro ao buscar integração de API', error: err.message }, statusCode);
  }
};
