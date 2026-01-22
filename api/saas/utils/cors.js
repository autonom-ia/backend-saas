// Shared CORS utilities for API Gateway Lambda handlers (saas)
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
    if (hostname === 'hub2you.ai') return true;
    if (hostname === 'portal-autonomia.vercel.app') return true;
    return hostname.endsWith('.autonomia.site') || hostname.endsWith('.hub2you.ai');
  } catch (_) {
    return false;
  }
}

function isAllowedOrigin(origin) {
  if (!origin) {
    console.log('[CORS] No origin provided');
    return false;
  }
  
  // Em staging, aceitar localhost e domínios da Vercel
  const isStaging = process.env.NODE_ENV === 'staging';
  console.log('[CORS] Origin:', origin, 'NODE_ENV:', process.env.NODE_ENV, 'isStaging:', isStaging);
  
  if (isStaging) {
    if (isLocalhost(origin)) {
      console.log('[CORS] Allowed: localhost');
      return true;
    }
    if (isVercelOrigin(origin)) {
      console.log('[CORS] Allowed: Vercel origin');
      return true;
    }
  }
  
  // Verificar origens permitidas específicas
  if (allowedLocalOrigins.has(origin)) {
    console.log('[CORS] Allowed: in allowedLocalOrigins set');
    return true;
  }
  
  // Verificar origens autonomia.site
  const isAutonomia = isAllowedAutonomiaOrigin(origin);
  if (isAutonomia) {
    console.log('[CORS] Allowed: autonomia.site origin');
  } else {
    console.log('[CORS] Denied: origin not allowed');
  }
  return isAutonomia;
}

function buildCorsHeaders(origin) {
  const base = {
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,x-user-id,X-User-Id',
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

module.exports = { buildCorsHeaders, getOrigin, preflight, isAllowedOrigin };
 
// Higher-order handler wrapper to apply CORS automatically
function withCors(handler) {
  return async function(event, context) {
    if (event && event.httpMethod === 'OPTIONS') {
      return preflight(event);
    }
    const res = await handler(event, context);
    const origin = getOrigin(event);
    const headers = buildCorsHeaders(origin);
    return {
      statusCode: res && typeof res.statusCode === 'number' ? res.statusCode : 200,
      headers: { ...(res && res.headers ? res.headers : {}), ...headers, 'Content-Type': 'application/json' },
      body: res && typeof res.body === 'string' ? res.body : JSON.stringify(res && res.body ? res.body : res),
    };
  };
}

module.exports.withCors = withCors;
