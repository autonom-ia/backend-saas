const { getDbConnection } = require('../utils/database');
const { updateAccount } = require('../services/account-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para atualizar uma conta
 */
exports.handler = async (event) => {
  try {
    const accountId = event?.pathParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { social_name, name, email, phone, product_id, document, instance, conversation_funnel_id } = body;

    if (
      social_name === undefined && name === undefined && email === undefined &&
      phone === undefined && product_id === undefined && document === undefined && instance === undefined &&
      conversation_funnel_id === undefined
    ) {
      return errorResponse({ success: false, message: 'Pelo menos um campo deve ser fornecido para atualização' }, 400);
    }

    const updated = await updateAccount(accountId, { social_name, name, email, phone, product_id, document, instance, conversation_funnel_id });
    return success({ success: true, message: 'Conta atualizada com sucesso', data: updated }, 200);
  } catch (error) {
    if (error?.message === 'Conta não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404);
    }
    console.error('Erro ao atualizar conta:', error);
    return errorResponse({ success: false, message: 'Erro ao atualizar conta', error: error.message }, 500);
  }
};
