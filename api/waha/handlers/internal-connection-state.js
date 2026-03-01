const { connectionState } = require('../services/waha-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');
const { requireInternalToken } = require('../utils/internal-auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    requireInternalToken(event);

    const origin = getOrigin(event);
    const qs = event.queryStringParameters || {};
    const accountId = qs.account_id;
    const inboxId = qs.inbox_id;

    if (!accountId) {
      return createResponse(400, { message: 'account_id is required' }, origin);
    }
    if (!inboxId) {
      return createResponse(400, { message: 'inbox_id is required' }, origin);
    }

    const result = await connectionState(accountId, inboxId);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Error in InternalConnectionState (Waha):', err);
    return createResponse(500, { message: 'Error getting connection state', details: err.message }, getOrigin(event));
  }
};
