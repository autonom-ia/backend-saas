const { getDbConnection } = require('../utils/database');
const { createAccountParameter } = require('../services/account-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para criar parâmetro de conta
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, value, account_id } = body;
    if (!name || !account_id) {
      return errorResponse({ success: false, message: 'Campos obrigatórios: name, account_id' }, 400);
    }

    const created = await createAccountParameter({ name, value, account_id });
    return success({ success: true, message: 'Parâmetro de conta criado com sucesso', data: created }, 201);
  } catch (error) {
    console.error('Erro ao criar parâmetro de conta:', error);
    return errorResponse({ success: false, message: 'Erro ao criar parâmetro de conta', error: error.message }, 500);
  }
};
