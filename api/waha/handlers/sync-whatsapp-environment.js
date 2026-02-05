const { syncWhatsappEnvironment } = require('../services/waha-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const origin = getOrigin(event);

    let body = {};
    try {
      if (event.body && String(event.body).trim()) {
        body = JSON.parse(event.body);
      }
    } catch (parseErr) {
      console.warn('[sync-whatsapp-environment] Failed to parse body, using empty object', parseErr.message);
    }

    const qs = event.queryStringParameters || {};

    const accountId = body.account_id || qs.account_id;
    const inboxId = body.inbox_id || qs.inbox_id;

    if (!accountId) {
      return createResponse(400, { message: 'account_id is required' }, origin);
    }
    if (!inboxId) {
      return createResponse(400, { message: 'inbox_id is required' }, origin);
    }
    const result = await syncWhatsappEnvironment(accountId, inboxId);
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('Error in SyncWhatsappEnvironment (Waha):', err);
    return createResponse(500, { message: 'Error syncing WhatsApp environment', details: err.message }, getOrigin(event));
  }
};
