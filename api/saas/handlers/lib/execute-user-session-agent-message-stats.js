const { success, error: errorResponse } = require('../../utils/response');
const { getDailyUserSessionAgentMessageStats } = require('../../services/user-session-agent-message-service');

/**
 * Lógica partilhada entre a rota Cognito e a rota Internal (BFF com X-Internal-Integration-Token).
 * @param {import('aws-lambda').APIGatewayProxyEvent} event
 */
exports.executeUserSessionAgentMessageStats = async (event) => {
  const query = event.queryStringParameters || {};
  const accountId = query.accountId;
  const startDate = query.startDate;
  const endDate = query.endDate;

  try {
    if (!accountId) {
      return errorResponse({ success: false, message: 'accountId é obrigatório' }, 400, event);
    }
    if (!startDate) {
      return errorResponse({ success: false, message: 'startDate é obrigatório (YYYY-MM-DD)' }, 400, event);
    }
    if (!endDate) {
      return errorResponse({ success: false, message: 'endDate é obrigatório (YYYY-MM-DD)' }, 400, event);
    }

    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;
    const stats = await getDailyUserSessionAgentMessageStats({
      accountId,
      startDate: start,
      endDate: end,
    });
    return success({ success: true, data: stats }, 200, event);
  } catch (err) {
    console.error('[user-session-agent-message-stats] ', err);
    return errorResponse(
      { success: false, message: 'Erro ao obter estatísticas de mensagens do agente', error: err.message },
      500,
      event
    );
  }
};
