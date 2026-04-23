const { assertInternalIntegrationToken } = require('../utils/settings-internal-auth');
const { error: errorResponse } = require('../utils/response');
const { executeUserSessionAgentMessageStats } = require('./lib/execute-user-session-agent-message-stats');

/**
 * BFF: só `X-Internal-Integration-Token` (não passa no Cognito).
 * Path: Autonomia/Saas/Internal/UserSessionAgentMessages/Stats?accountId&startDate&endDate
 */
exports.handler = async (event) => {
  const auth = assertInternalIntegrationToken(event);
  if (!auth.ok) {
    return errorResponse(
      auth.body && typeof auth.body === 'object' ? auth.body : { success: false, message: 'Não autorizado' },
      auth.status || 401,
      event
    );
  }
  return executeUserSessionAgentMessageStats(event);
};
