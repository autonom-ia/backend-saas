const { getDbConnection } = require('../utils/database');
const { updateAccountParameter } = require('../services/account-parameter-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para atualizar parâmetro de conta
 */
exports.handler = async (event) => {
  try {
    const parameterId = event?.pathParameters?.parameterId;
    if (!parameterId) {
      return errorResponse({ success: false, message: 'Parâmetro parameterId é obrigatório' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, value, account_id } = body;
    if (name === undefined && value === undefined && account_id === undefined) {
      return errorResponse({ success: false, message: 'Forneça ao menos um campo para atualizar' }, 400);
    }

    const updated = await updateAccountParameter(parameterId, { name, value, account_id });
    return success({ success: true, message: 'Parâmetro de conta atualizado com sucesso', data: updated }, 200);
  } catch (error) {
    if (error?.message === 'Parâmetro de conta não encontrado') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao atualizar parâmetro de conta:', error);
    return errorResponse({ success: false, message: 'Erro ao atualizar parâmetro de conta', error: error.message }, 500);
  }
};
