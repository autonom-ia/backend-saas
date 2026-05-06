const { getDbConnection } = require('../utils/database');
const {
  getAllMessagesByAccountId,
  getAllMessagesByConversationFunnelId,
} = require('../services/conversation-funnel-step-message-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para listar mensagens de steps de funil filtrando por accountId ou conversationFunnelId (querystring)
 */
exports.handler = async (event) => {
  try {
    const query = event?.queryStringParameters || {};
    const accountId = query.accountId;
    const conversationFunnelId = query.conversationFunnelId || query.conversation_funnel_id;

    if (!accountId && !conversationFunnelId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId ou conversationFunnelId é obrigatório' }, 400);
    }

    const items = conversationFunnelId
      ? await getAllMessagesByConversationFunnelId(conversationFunnelId)
      : await getAllMessagesByAccountId(accountId);

    return success({ success: true, data: items }, 200);
  } catch (error) {
    console.error('Erro ao listar mensagens de steps de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao listar mensagens de steps de funil', error: error.message }, 500);
  }
};
