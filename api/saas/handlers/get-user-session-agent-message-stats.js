const { executeUserSessionAgentMessageStats } = require('./lib/execute-user-session-agent-message-stats');

/** Cognito (API Gateway authorizer). A lógica fica partilhada com a rota Internal. */
exports.handler = async (event) => {
  return executeUserSessionAgentMessageStats(event);
};
