const { getDbConnection } = require('../utils/database');
const { createFunnel } = require('../services/conversation-funnel-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para criar funil de conversação
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { name, description, is_default } = body;
    if (!name || !description) {
      return errorResponse({ success: false, message: 'Campos obrigatórios: name, description' }, 400);
    }

    const created = await createFunnel({ name, description, is_default });
    return success({ success: true, message: 'Funil criado com sucesso', data: created }, 201);
  } catch (error) {
    console.error('Erro ao criar funil:', error);
    return errorResponse({ success: false, message: 'Erro ao criar funil', error: error.message }, 500);
  }
};

