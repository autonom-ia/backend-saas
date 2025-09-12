const { getDbConnection } = require('../utils/database');
const { deleteAccount } = require('../services/account-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para remover uma conta por ID
 */
exports.handler = async (event) => {
  try {
    const accountId = event?.pathParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400);
    }

    await deleteAccount(accountId);
    return success({ success: true, message: 'Conta removida com sucesso' }, 200);
  } catch (error) {
    if (error?.message === 'Conta não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao remover conta:', error);
    return errorResponse({ success: false, message: 'Erro ao remover conta', error: error.message }, 500);
  }
};
