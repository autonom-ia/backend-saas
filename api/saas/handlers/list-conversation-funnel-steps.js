const { getDbConnection } = require('../utils/database');
const {
  getAllStepsByAccountId,
  getAllStepsByConversationFunnelId,
} = require('../services/conversation-funnel-step-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar steps de funil filtrando por accountId ou conversationFunnelId (querystring)
 */
exports.handler = withCors(async (event) => {
  try {
    const query = event?.queryStringParameters || {};
    const accountId = query.accountId;
    const conversationFunnelId = query.conversationFunnelId || query.conversation_funnel_id;

    if (!accountId && !conversationFunnelId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId ou conversationFunnelId é obrigatório' }, 400, event);
    }

    const items = conversationFunnelId
      ? await getAllStepsByConversationFunnelId(conversationFunnelId)
      : await getAllStepsByAccountId(accountId);

    return success({ success: true, data: items }, 200, event);
  } catch (error) {
    console.error('Erro ao listar steps do funil:', error);
    return errorResponse({ success: false, message: 'Erro ao listar steps do funil', error: error.message }, 500, event);
  }
});
