const { connectionState } = require('../services/waha-service');
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
    const inboxId = body.inbox_id || qs.inbox_id;

    if (!accountId) {
      return createResponse(400, { message: 'account_id is required' }, origin);
    }
    if (!inboxId) {
      return createResponse(400, { message: 'inbox_id is required' }, origin);
    }

    const result = await connectionState(accountId, inboxId);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Error in ConnectionState (Waha):', err);
    return createResponse(500, { message: 'Error getting session state', details: err.message }, getOrigin(event));
  }
};
