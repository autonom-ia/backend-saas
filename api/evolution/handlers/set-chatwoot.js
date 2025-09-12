const { setChatwoot } = require('../services/evolution-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const origin = getOrigin(event);
    const body = JSON.parse(event.body || '{}');
    const qs = event.queryStringParameters || {};
    const domain = body.domain || qs.domain;

    const { instanceName } = body;
    if (!instanceName) {
      return createResponse(400, { message: 'instanceName é obrigatório' }, origin);
    }
    if (!domain) {
      return createResponse(400, { message: 'domain é obrigatório' }, origin);
    }

    // Pass-through all fields to Evolution API
    const payload = { ...body };
    const result = await setChatwoot(domain, instanceName, payload);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Erro em SetChatwoot:', err);
    return createResponse(500, { message: 'Erro ao configurar Chatwoot', details: err.message }, getOrigin(event));
  }
};
