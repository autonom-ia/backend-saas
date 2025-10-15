const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

/**
 * Handler para criar um template de mensagem
 */
exports.handler = withCors(async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { account_id, name, message_text } = body;

    // Validações básicas
    if (!account_id) {
      return errorResponse({
        success: false,
        message: 'ID da conta é obrigatório'
      }, 400, event);
    }

    if (!name) {
      return errorResponse({
        success: false,
        message: 'Nome do template é obrigatório'
      }, 400, event);
    }

    if (!message_text) {
      return errorResponse({
        success: false,
        message: 'Texto da mensagem é obrigatório'
      }, 400, event);
    }

    const db = getDbConnection();

    // Verificar se a conta existe
    const account = await db('account').where('id', account_id).first();
    if (!account) {
      return errorResponse({
        success: false,
        message: 'Conta não encontrada'
      }, 404, event);
    }

    // Verificar se já existe um template com o mesmo nome para esta conta
    const existingTemplate = await db('template_message')
      .where('account_id', account_id)
      .where('name', name)
      .first();

    if (existingTemplate) {
      return errorResponse({
        success: false,
        message: 'Já existe um template com este nome para esta conta'
      }, 409, event);
    }

    // Criar o template de mensagem
    const templateData = {
      account_id,
      name,
      message_text
    };

    const [templateMessage] = await db('template_message')
      .insert(templateData)
      .returning('*');

    console.log('Template de mensagem criado:', templateMessage);

    return success({
      success: true,
      message: 'Template de mensagem criado com sucesso',
      data: templateMessage
    }, 201, event);

  } catch (error) {
    console.error('Erro ao criar template de mensagem:', error);
    return errorResponse({
      success: false,
      message: 'Erro ao criar template de mensagem',
      error: error.message
    }, 500, event);
  }
});
