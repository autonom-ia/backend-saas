const { getDbConnection } = require('../utils/database');
const { getAccountParameterById } = require('../services/account-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para buscar parâmetro de conta por ID
 */
exports.handler = async (event) => {
  try {
    const parameterId = event?.pathParameters?.parameterId;
    if (!parameterId) {
      return errorResponse({ success: false, message: 'Parâmetro parameterId é obrigatório' }, 400);
    }

    const item = await getAccountParameterById(parameterId);
    return success({ success: true, data: item }, 200);
  } catch (error) {
    if (error?.message === 'Parâmetro de conta não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao buscar parâmetro de conta:', error);
    return errorResponse({ success: false, message: 'Erro ao buscar parâmetro de conta', error: error.message }, 500);
  }
};
