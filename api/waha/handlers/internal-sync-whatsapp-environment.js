const { syncWhatsappEnvironment } = require('../services/waha-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');
const { requireInternalToken } = require('../utils/internal-auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    requireInternalToken(event);

    const origin = getOrigin(event);
    const body = JSON.parse(event.body || '{}');
    const accountId = body.account_id;
    const inboxId = body.inbox_id;

    if (!accountId) {
      return createResponse(400, { message: 'account_id is required' }, origin);
    }
    if (!inboxId) {
      return createResponse(400, { message: 'inbox_id is required' }, origin);
    }

    await syncWhatsappEnvironment(accountId, inboxId);
    return createResponse(200, { message: 'Environment sync started' }, origin);
  } catch (err) {
    console.error('Error in InternalSyncWhatsappEnvironment (Waha):', err);
    return createResponse(500, { message: 'Error syncing WhatsApp environment', details: err.message }, getOrigin(event));
  }
};
