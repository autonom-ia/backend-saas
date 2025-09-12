const { getDbConnection } = require('../utils/database');
const { getAccountById } = require('../services/account-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para buscar conta por ID
 */
exports.handler = withCors(async (event) => {
  try {
    const accountId = event?.pathParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400, event);
    }

    const account = await getAccountById(accountId);
    return success({ success: true, data: account }, 200, event);
  } catch (error) {
    if (error?.message === 'Conta não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404, event);
    }
    console.error('Erro ao buscar conta:', error);
    return errorResponse({ success: false, message: 'Erro ao buscar conta', error: error.message }, 500, event);
  }
});
