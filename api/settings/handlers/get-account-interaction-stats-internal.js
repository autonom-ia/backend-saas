const { getDailyMergedAccountInteractionStats } = require('../services/account-interaction-service');
const { success, error } = require('../utils/response');
const { validateInternalIntegrationRequest } = require('../utils/internal-integration-auth');

module.exports.handler = async (event) => {
  const auth = validateInternalIntegrationRequest(event);
  if (auth) {
    return error({ success: false, message: auth.message }, auth.code, event);
  }

  const query = event.queryStringParameters || {};
  const accountId = query.accountId;
  const startDate = query.startDate;
  const endDate = query.endDate;

  try {
    if (!accountId) {
      return error({ success: false, message: 'accountId é obrigatório' }, 400, event);
    }
    if (!startDate) {
      return error({ success: false, message: 'startDate é obrigatório (YYYY-MM-DD)' }, 400, event);
    }
    if (!endDate) {
      return error({ success: false, message: 'endDate é obrigatório (YYYY-MM-DD)' }, 400, event);
    }

    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;
    const stats = await getDailyMergedAccountInteractionStats({
      accountId,
      startDate: start,
      endDate: end,
    });
    return success({ success: true, data: stats }, 200, event);
  } catch (err) {
    console.error('[settings:get-account-interaction-stats-internal] Erro:', err);
    return error(
      { success: false, message: 'Erro ao obter estatísticas de interações', error: err.message },
      500,
      event
    );
  }
};
