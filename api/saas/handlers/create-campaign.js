const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

/**
 * Handler para criar uma nova campanha
 */
exports.handler = withCors(async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { name, description, account_id, template_message_id } = body;

    // Validações básicas
    if (!name) {
      return errorResponse({
        success: false,
        message: 'Nome da campanha é obrigatório'
      }, 400, event);
    }

    if (!account_id) {
      return errorResponse({
        success: false,
        message: 'ID da conta é obrigatório'
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

    // Se template_message_id foi fornecido, verificar se existe
    if (template_message_id) {
      const templateMessage = await db('template_message').where('id', template_message_id).first();
      if (!templateMessage) {
        return errorResponse({
          success: false,
          message: 'Template de mensagem não encontrado'
        }, 404, event);
      }
    }

    // Criar a campanha
    const campaignData = {
      name,
      description: description || null,
      account_id,
      template_message_id: template_message_id || null
    };

    const [campaign] = await db('campaign')
      .insert(campaignData)
      .returning('*');

    console.log('Campanha criada:', campaign);

    return success({
      success: true,
      message: 'Campanha criada com sucesso',
      data: campaign
    }, 201, event);

  } catch (error) {
    console.error('Erro ao criar campanha:', error);
    return errorResponse({
      success: false,
      message: 'Erro ao criar campanha',
      error: error.message
    }, 500, event);
  }
});
