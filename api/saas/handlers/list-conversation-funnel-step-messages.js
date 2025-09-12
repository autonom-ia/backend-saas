const { getDbConnection } = require('../utils/database');
const { getAllMessagesByAccountId } = require('../services/conversation-funnel-step-message-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para listar mensagens de steps de funil filtrando por accountId (querystring)
 */
exports.handler = async (event) => {
  try {
    const accountId = event?.queryStringParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400);
    }
    const items = await getAllMessagesByAccountId(accountId);
    return success({ success: true, data: items }, 200);
  } catch (error) {
    console.error('Erro ao listar mensagens de steps de funil:', error);
    return errorResponse({ success: false, message: 'Erro ao listar mensagens de steps de funil', error: error.message }, 500);
  }
};
