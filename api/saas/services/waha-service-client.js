// In Node.js 18+ (Lambda nodejs18.x runtime), fetch is available globally.
// We just alias it here to avoid depending on node-fetch.
const fetch = global.fetch;

function getWahaBaseUrl() {
  const envUrl = process.env.WAHA_URL || process.env.WAHA_API_URL || '';
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  // fallback padrão para o API Gateway do WAHA
  return 'https://api-waha.autonomia.site';
}

async function createInternalSession({ accountId, inboxId }) {
  const baseUrl = getWahaBaseUrl();
  const url = `${baseUrl}/Autonomia/Waha/Internal/Sessions`;

  const token = process.env.INTERNAL_INTEGRATION_TOKEN || '';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-internal-token': token } : {}),
    },
    body: JSON.stringify({ account_id: accountId, inbox_id: inboxId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const error = new Error(`WAHA internal session creation failed with status ${res.status}`);
    error.statusCode = res.status;
    error.body = text;
    throw error;
  }

  return res.json().catch(() => ({}));
}

async function getInternalConnectionState({ accountId, inboxId }) {
  const baseUrl = getWahaBaseUrl();
  const url = `${baseUrl}/Autonomia/Waha/Internal/ConnectionState?account_id=${encodeURIComponent(
    accountId,
  )}&inbox_id=${encodeURIComponent(inboxId)}`;

  const token = process.env.INTERNAL_INTEGRATION_TOKEN || '';

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...(token ? { 'x-internal-token': token } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const error = new Error(`WAHA internal connection state failed with status ${res.status}`);
    error.statusCode = res.status;
    error.body = text;
    throw error;
  }

  return res.json().catch(() => ({}));
}

async function syncInternalWhatsappEnvironment({ accountId, inboxId }) {
  const baseUrl = getWahaBaseUrl();
  const url = `${baseUrl}/Autonomia/Waha/Internal/SyncWhatsappEnvironment`;

  const token = process.env.INTERNAL_INTEGRATION_TOKEN || '';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-internal-token': token } : {}),
    },
    body: JSON.stringify({ account_id: accountId, inbox_id: inboxId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const error = new Error(`WAHA internal sync failed with status ${res.status}`);
    error.statusCode = res.status;
    error.body = text;
    throw error;
  }

  return res.json().catch(() => ({}));
}

async function cleanupCancelledAccount({ accountId, token }) {
  const startedAt = Date.now();
  const baseUrl = getWahaBaseUrl();
  const url = `${baseUrl}/Autonomia/Waha/Accounts/${encodeURIComponent(accountId)}/CleanupCancelledAccount`;
  const authHeader = token && !token.startsWith('Bearer ') ? `Bearer ${token}` : (token || '');

  console.info('[waha-service-client] cleanupCancelledAccount started', {
    accountId,
    baseUrl,
    url,
    hasAuthorization: !!authHeader,
  });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ account_id: accountId }),
    });
  } catch (error) {
    console.error('[waha-service-client] cleanupCancelledAccount fetch failed', {
      accountId,
      baseUrl,
      url,
      elapsedMs: Date.now() - startedAt,
      error: error?.message || String(error),
      cause: error?.cause
        ? {
            message: error.cause?.message || String(error.cause),
            code: error.cause?.code || null,
            stack: error.cause?.stack || null,
          }
        : null,
    });
    throw error;
  }

  console.info('[waha-service-client] cleanupCancelledAccount response received', {
    accountId,
    status: res.status,
    ok: res.ok,
    elapsedMs: Date.now() - startedAt,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[waha-service-client] cleanupCancelledAccount non-ok response', {
      accountId,
      status: res.status,
      body: text,
      elapsedMs: Date.now() - startedAt,
    });
    const error = new Error(`WAHA cleanup failed with status ${res.status}`);
    error.statusCode = res.status;
    error.body = text;
    throw error;
  }

  const payload = await res.json().catch(() => ({}));
  console.info('[waha-service-client] cleanupCancelledAccount completed', {
    accountId,
    elapsedMs: Date.now() - startedAt,
    payload,
  });
  return payload;
}

module.exports = {
  createInternalSession,
  getInternalConnectionState,
  syncInternalWhatsappEnvironment,
  cleanupCancelledAccount,
};
