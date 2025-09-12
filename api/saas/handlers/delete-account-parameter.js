const { getDbConnection } = require('../utils/database');
const { deleteAccountParameter } = require('../services/account-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para remover parâmetro de conta por ID
 */
exports.handler = async (event) => {
  try {
    const parameterId = event?.pathParameters?.parameterId;
    if (!parameterId) {
      return errorResponse({ success: false, message: 'Parâmetro parameterId é obrigatório' }, 400);
    }

    await deleteAccountParameter(parameterId);
    return success({ success: true, message: 'Parâmetro de conta removido com sucesso' }, 200);
  } catch (error) {
    if (error?.message === 'Parâmetro de conta não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao remover parâmetro de conta:', error);
    return errorResponse({ success: false, message: 'Erro ao remover parâmetro de conta', error: error.message }, 500);
  }
};
