const { connectionState } = require('../services/evolution-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const origin = getOrigin(event);
    const qs = event.queryStringParameters || {};
    const { instance, account_id: qsAccountId } = qs;
    const body = JSON.parse(event.body || '{}');
    const accountId = qsAccountId || body.account_id;

    if (!instance) {
      return createResponse(400, { message: 'Parâmetro instance é obrigatório' }, origin);
    }
    if (!accountId) {
      return createResponse(400, { message: 'account_id é obrigatório' }, origin);
    }

    const result = await connectionState(accountId, instance);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Erro em ConnectionState:', err);
    return createResponse(500, { message: 'Erro ao obter estado da instância', details: err.message }, getOrigin(event));
  }
};
