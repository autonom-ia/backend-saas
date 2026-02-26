const requireInternalToken = (event) => {
  const configuredToken = process.env.INTERNAL_INTEGRATION_TOKEN || '';
  const providedToken =
    (event.headers && (event.headers['x-internal-token'] || event.headers['X-Internal-Token'])) || '';

  if (!configuredToken || !providedToken || configuredToken !== providedToken) {
    const err = new Error('UNAUTHORIZED');
    err.statusCode = 401;
    throw err;
  }
};

module.exports = {
  requireInternalToken,
};
