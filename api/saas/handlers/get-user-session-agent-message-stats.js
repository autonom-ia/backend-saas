const { success, error: errorResponse } = require('../utils/response');
const { getDailyUserSessionAgentMessageStats } = require('../services/user-session-agent-message-service');

exports.handler = async (event) => {
  try {
    const query = event.queryStringParameters || {};
    const accountId = query.accountId;
    const startDate = query.startDate;
    const endDate = query.endDate;

    if (!accountId) {
      return errorResponse({ success: false, message: 'accountId é obrigatório' }, 400);
    }

    if (!startDate) {
      return errorResponse({ success: false, message: 'startDate é obrigatório (YYYY-MM-DD)' }, 400);
    }

    if (!endDate) {
      return errorResponse({ success: false, message: 'endDate é obrigatório (YYYY-MM-DD)' }, 400);
    }

    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    const stats = await getDailyUserSessionAgentMessageStats({
      accountId,
      startDate: start,
      endDate: end,
    });

    return success({ success: true, data: stats }, 200);
  } catch (err) {
    console.error('[get-user-session-agent-message-stats] Erro ao obter estatísticas de mensagens do agente:', err);
    return errorResponse({ success: false, message: 'Erro ao obter estatísticas de mensagens do agente', error: err.message }, 500);
  }
};
