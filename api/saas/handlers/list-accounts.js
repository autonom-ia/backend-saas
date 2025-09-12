const { getDbConnection } = require('../utils/database');
const { getAllAccounts } = require('../services/account-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar contas filtradas por productId (querystring)
 */
exports.handler = withCors(async (event) => {
  try {
    const productId = event?.queryStringParameters?.productId;

    if (!productId) {
      return errorResponse({
        success: false,
        message: 'Parâmetro productId é obrigatório'
      }, 400, event);
    }

    const accounts = await getAllAccounts(productId);
    return success({ success: true, data: accounts }, 200, event);
  } catch (error) {
    console.error('Erro ao listar contas:', error);
    return errorResponse({
      success: false,
      message: 'Erro ao listar contas',
      error: error.message
    }, 500, event);
  }
});
