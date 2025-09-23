const { resendUnprocessedToChatwoot } = require('../services/resend-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  const origin = getOrigin(event);
  try {
    // Fixed execution parameters (no request body expected)
    const result = await resendUnprocessedToChatwoot({
      // accountId uses the default inside the service (DEFAULT_ACCOUNT_ID)
      lookbackSeconds: 120,
      batchLimit: 50,
      inferFromSiblings: true,
      allowCreateConversation: false,
      siblingLookbackSeconds: 43200,
      requestTimeoutMs: 12000,
      dryRun: false,
    });
    return createResponse(200, result, origin);
  } catch (err) {
    console.error('[ResendUnprocessed] error', err);
    return createResponse(500, { message: 'Erro ao reprocessar mensagens', details: err?.message || String(err) }, origin);
  }
};
