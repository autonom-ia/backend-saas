const { getDbConnection } = require('../utils/database');
const { getAllAccountParameters } = require('../services/account-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para listar parâmetros de conta filtrados por accountId (querystring)
 */
exports.handler = async (event) => {
  try {
    const accountId = event?.queryStringParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400);
    }
    const items = await getAllAccountParameters(accountId);
    return success({ success: true, data: items }, 200);
  } catch (error) {
    console.error('Erro ao listar parâmetros de conta:', error);
    return errorResponse({ success: false, message: 'Erro ao listar parâmetros de conta', error: error.message }, 500);
  }
};
