// Shared CORS utilities for API Gateway Lambda handlers (evolution)
const allowedLocalOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function isLocalhost(origin) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch (_) {
    return false;
  }
}

function isVercelOrigin(origin) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    // Permite qualquer domínio da Vercel (incluindo preview deployments)
    return hostname.endsWith('.vercel.app');
  } catch (_) {
    return false;
  }
}

function isAllowedAutonomiaOrigin(origin) {
  try {
    const url = new URL(origin);
    const { protocol, hostname } = url;
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    if (hostname === 'autonomia.site') return true;
    return hostname.endsWith('.autonomia.site');
  } catch (_) {
    return false;
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  
  // Em staging, aceitar localhost e domínios da Vercel
  const isStaging = process.env.NODE_ENV === 'staging';
  if (isStaging) {
    if (isLocalhost(origin)) return true;
    if (isVercelOrigin(origin)) return true;
  }
  
  // Verificar origens permitidas específicas
  if (allowedLocalOrigins.has(origin)) return true;
  
  // Verificar origens autonomia.site
  return isAllowedAutonomiaOrigin(origin);
}

function buildCorsHeaders(origin) {
  const base = {
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Vary': 'Origin',
  };
  if (isAllowedOrigin(origin)) {
    return { ...base, 'Access-Control-Allow-Origin': origin };
  }
  return { ...base, 'Access-Control-Allow-Origin': 'null' };
}

function getOrigin(event) {
  const h = event && event.headers ? event.headers : {};
  return h.origin || h.Origin || '';
}

function preflight(event) {
  const origin = getOrigin(event);
  if (!isAllowedOrigin(origin)) {
    return {
      statusCode: 403,
      headers: buildCorsHeaders(origin),
      body: JSON.stringify({ message: 'CORS origin not allowed' }),
    };
  }
  return {
    statusCode: 204,
    headers: buildCorsHeaders(origin),
    body: '',
  };
}

function createResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      ...buildCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

module.exports = { createResponse, preflight, getOrigin, isAllowedOrigin };
