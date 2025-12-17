const { success, error: errorResponse } = require('../utils/response');
const { createAccountIntegrationApi } = require('../services/account-integration-api-service');

exports.handler = async (event) => {
  try {
    const accountId = event.pathParameters && event.pathParameters.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'accountId é obrigatório' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const requiredFields = [
      'name',
      'slug',
      'agent_instruction',
      'base_url',
      'path_template',
      'http_method',
    ];

    const missing = requiredFields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
    if (missing.length > 0) {
      return errorResponse({ success: false, message: `Campos obrigatórios ausentes: ${missing.join(', ')}` }, 400);
    }

    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!allowedMethods.includes(body.http_method)) {
      return errorResponse({ success: false, message: 'http_method inválido' }, 400);
    }

    const created = await createAccountIntegrationApi(accountId, body);

    return success({ success: true, data: created }, 201);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[createAccountIntegrationApi] Erro:', err);
    return errorResponse({ success: false, message: 'Erro ao criar integração de API', error: err.message }, statusCode);
  }
};
