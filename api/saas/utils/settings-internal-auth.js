const crypto = require('crypto');

const HEADER_NAMES = ['X-Internal-Integration-Token', 'x-internal-integration-token'];

/**
 * Valida o token interno (LP / server-to-server). Não usa Cognito.
 * Ordem: SETTINGS_ONBOARDING_INTERNAL_TOKEN (SSM dedicado) → INTERNAL_INTEGRATION_TOKEN.
 */
function assertInternalIntegrationToken(event) {
  const primary = process.env.SETTINGS_ONBOARDING_INTERNAL_TOKEN;
  const fallback = process.env.INTERNAL_INTEGRATION_TOKEN;
  const expected =
    primary != null && String(primary).trim()
      ? String(primary).trim()
      : fallback != null && String(fallback).trim()
        ? String(fallback).trim()
        : '';

  if (!expected) {
    return {
      ok: false,
      status: 503,
      body: {
        success: false,
        message:
          'Configure SETTINGS_ONBOARDING_INTERNAL_TOKEN ou INTERNAL_INTEGRATION_TOKEN (SSM) para esta rota',
      },
    };
  }

  const headers = event.headers || {};
  let received = '';
  for (const name of HEADER_NAMES) {
    const v = headers[name];
    if (v != null && String(v).trim()) {
      received = String(v).trim();
      break;
    }
  }

  const exp = String(expected).trim();
  if (!received || !timingSafeEqualString(received, exp)) {
    return {
      ok: false,
      status: 401,
      body: { success: false, message: 'Token interno inválido ou ausente (header X-Internal-Integration-Token)' },
    };
  }

  return { ok: true };
}

function timingSafeEqualString(a, b) {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * JWT (ou token aceite pelo financial/payment) para createAccountSubscription / associateOnboardingData.
 * Ordem: Authorization Bearer → env SETTINGS_ONBOARDING_FINANCIAL_BEARER_TOKEN (opcional, SSM).
 */
function getFinancialBearerToken(event) {
  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? '';
  const fromAuth = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (fromAuth) return fromAuth;

  const fallback = process.env.SETTINGS_ONBOARDING_FINANCIAL_BEARER_TOKEN;
  if (fallback != null && String(fallback).trim()) return String(fallback).trim();

  return '';
}

module.exports = {
  assertInternalIntegrationToken,
  getFinancialBearerToken,
};
