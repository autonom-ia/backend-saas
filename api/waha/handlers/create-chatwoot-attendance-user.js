const { createChatwootAttendanceUser } = require('../services/waha-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const origin = getOrigin(event);
    const body = JSON.parse(event.body || '{}');
    const qs = event.queryStringParameters || {};

    const accountId = body.account_id || qs.account_id;
    const email = body.email;
    const password = body.password;

    if (!accountId) {
      return createResponse(400, { message: 'account_id is required' }, origin);
    }

    if (!email || !password) {
      return createResponse(400, { message: 'email and password are required' }, origin);
    }

    const result = await createChatwootAttendanceUser(accountId, email, password);

    const { chatwootAccountId, chatwootUrl } = result || {};

    return createResponse(
      201,
      {
        success: true,
        message: 'Atendimento conectado com sucesso.',
        chatwootUrl,
        chatwootAccountId,
      },
      origin,
    );
  } catch (err) {
    console.error('Error in createChatwootAttendanceUser (Waha):', err);
    return createResponse(
      500,
      { message: 'Error creating Chatwoot attendance user', details: err.message },
      getOrigin(event),
    );
  }
};
