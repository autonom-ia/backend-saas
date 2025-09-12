const { getDbConnection } = require('../utils/database');
const { getAllStepsByAccountId } = require('../services/conversation-funnel-step-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar steps de funil filtrando por accountId (querystring)
 */
exports.handler = withCors(async (event) => {
  try {
    const accountId = event?.queryStringParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400, event);
    }
    const items = await getAllStepsByAccountId(accountId);
    return success({ success: true, data: items }, 200, event);
  } catch (error) {
    console.error('Erro ao listar steps do funil:', error);
    return errorResponse({ success: false, message: 'Erro ao listar steps do funil', error: error.message }, 500, event);
  }
});
