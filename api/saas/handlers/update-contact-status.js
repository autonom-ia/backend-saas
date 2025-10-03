const { updateContactStatus } = require('../services/campaign-import-service');
const { success, error: errorResponse } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const { withCors } = require('../utils/cors');

/**
 * Handler para atualizar status de um contato
 */
exports.handler = withCors(async (event, context) => {
  try {
    const contactId = event.pathParameters?.contactId;
    
    if (!contactId) {
      return errorResponse({ 
        success: false, 
        message: 'ID do contato é obrigatório' 
      }, 400, event);
    }

    // Parse do body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return errorResponse({ 
        success: false, 
        message: 'Body da requisição deve ser um JSON válido' 
      }, 400, event);
    }

    const { status, external_code } = body;

    if (!status) {
      return errorResponse({ 
        success: false, 
        message: 'Status é obrigatório' 
      }, 400, event);
    }

    // Validar status
    const validStatuses = ['pending', 'processing', 'sent', 'delivered', 'failed', 'read'];
    if (!validStatuses.includes(status)) {
      return errorResponse({ 
        success: false, 
        message: `Status inválido. Use: ${validStatuses.join(', ')}` 
      }, 400, event);
    }

    // Extrair email do usuário autenticado via Cognito Authorizer
    const claims = event?.requestContext?.authorizer?.claims || event?.requestContext?.authorizer?.jwt?.claims || {};
    const email = claims.email || claims['cognito:username'] || null;

    if (!email) {
      return errorResponse({ success: false, message: 'Não autenticado' }, 401, event);
    }

    // Buscar usuário no banco para obter id
    const knex = getDbConnection();
    const user = await knex('users').where({ email }).first();

    if (!user) {
      return errorResponse({ success: false, message: 'Usuário não encontrado' }, 404, event);
    }

    // Verificar se o usuário tem acesso ao contato através das contas
    const userAccounts = await knex('user_accounts')
      .where({ user_id: user.id })
      .pluck('account_id');

    if (userAccounts.length === 0) {
      return errorResponse({ 
        success: false, 
        message: 'Usuário não possui acesso a nenhuma conta' 
      }, 403, event);
    }

    // Verificar se o contato pertence a uma das contas do usuário
    const contact = await knex('contact')
      .where({ id: contactId })
      .whereIn('account_id', userAccounts)
      .first();

    if (!contact) {
      return errorResponse({ 
        success: false, 
        message: 'Contato não encontrado ou acesso negado' 
      }, 404, event);
    }

    // Atualizar status do contato
    const updatedContact = await updateContactStatus(contactId, status, external_code);
    
    return success({
      success: true,
      message: 'Status do contato atualizado com sucesso',
      data: updatedContact
    }, 200, event);

  } catch (error) {
    console.error('Erro ao atualizar status do contato:', error);
    
    return errorResponse({
      success: false,
      message: 'Erro ao atualizar status do contato',
      error: error.message
    }, 500, event);
  }
});
