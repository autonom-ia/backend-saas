const { connectionState } = require('../services/evolution-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const origin = getOrigin(event);
    const qs = event.queryStringParameters || {};
    const { instance, domain: qsDomain } = qs;
    const body = JSON.parse(event.body || '{}');
    const domain = qsDomain || body.domain;

    if (!instance) {
      return createResponse(400, { message: 'Parâmetro instance é obrigatório' }, origin);
    }
    if (!domain) {
      return createResponse(400, { message: 'domain é obrigatório' }, origin);
    }

    const result = await connectionState(domain, instance);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Erro em ConnectionState:', err);
    return createResponse(500, { message: 'Erro ao obter estado da instância', details: err.message }, getOrigin(event));
  }
};
