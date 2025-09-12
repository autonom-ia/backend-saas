const { buildCorsHeaders, getOrigin } = require('../utils/cors');

function createBody(input) {
  if (typeof input === 'string') return { message: input };
  if (input && typeof input === 'object') return input.message ? { message: input.message, ...input } : input;
  return {};
}

function success(body, statusCode = 200, event) {
  const origin = event ? getOrigin(event) : '';
  return {
    statusCode,
    headers: {
      ...(origin ? buildCorsHeaders(origin) : { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody(body)),
  };
}

function error(body, statusCode = 500, event) {
  const origin = event ? getOrigin(event) : '';
  return {
    statusCode,
    headers: {
      ...(origin ? buildCorsHeaders(origin) : { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody(body)),
  };
}

module.exports = { success, error };
