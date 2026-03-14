const { cleanupCancelledAccount } = require('../services/waha-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const origin = getOrigin(event);
    const body = JSON.parse(event.body || '{}');
    const qs = event.queryStringParameters || {};
    const accountId = body.account_id || qs.account_id || event.pathParameters?.accountId;

    if (!accountId) {
      return createResponse(400, { message: 'account_id is required' }, origin);
    }

    const result = await cleanupCancelledAccount(accountId);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Error in CleanupCancelledAccount (Waha):', err);
    return createResponse(500, { message: 'Error cleaning cancelled account', details: err.message }, getOrigin(event));
  }
};
