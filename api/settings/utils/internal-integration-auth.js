const crypto = require('crypto');
const { timingSafeEqual } = crypto;

const HEADER_NAMES = ['X-Internal-Integration-Token', 'x-internal-integration-token'];

/**
 * Lê o token a partir de headers (API Gateway pode normalizar nomes).
 * @param {import('aws-lambda').APIGatewayProxyEvent} event
 * @returns {string}
 */
function readInternalIntegrationTokenFromEvent(event) {
  const h = event.headers || event.multiValueHeaders;
  if (!h || typeof h !== 'object') {
    return '';
  }
  for (const name of HEADER_NAMES) {
    const v = h[name];
    if (v == null) continue;
    if (Array.isArray(v) && v[0]) {
      return String(v[0]).trim();
    }
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

function safeEqualString(a, b) {
  if (!a || !b) {
    return false;
  }
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * @returns {null | { code: 401 | 503, message: string }} null = autorizado
 */
function validateInternalIntegrationRequest(event) {
  const expected = (process.env.INTERNAL_INTEGRATION_TOKEN || '').trim();
  if (!expected) {
    return { code: 503, message: 'INTERNAL_INTEGRATION_TOKEN is not configured' };
  }
  const received = readInternalIntegrationTokenFromEvent(event);
  if (!received || !safeEqualString(received, expected)) {
    return { code: 401, message: 'Unauthorized: invalid or missing X-Internal-Integration-Token' };
  }
  return null;
}

module.exports = {
  readInternalIntegrationTokenFromEvent,
  validateInternalIntegrationRequest,
};
