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
    const accountId =
      event.pathParameters?.accountId ||
      body.account_id ||
      body.accountId ||
      qs.account_id ||
      qs.accountId;

    if (!accountId) {
      return createResponse(400, { message: 'account_id is required' }, origin);
    }

    const result = await cleanupCancelledAccount(accountId);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Error in CleanupCancelledAccount (Waha):', err);
    return createResponse(
      err?.statusCode || 500,
      { message: err?.message || 'Internal server error' },
      getOrigin(event)
    );
  }
};
