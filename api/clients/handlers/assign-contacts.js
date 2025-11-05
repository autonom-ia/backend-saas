/**
 * Handler para atribuir contatos automaticamente a agentes disponíveis
 */

const { assignContactToAgent } = require('../services/assign-service');
const { getDbConnection } = require('../utils/database');
const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido para atribuição:', JSON.stringify(event, null, 2));
    
    const body = JSON.parse(event.body || '{}');
    const { accountId, systemAccountId, contactId, inboxId, conversationId } = body;
    
    if (!accountId || !contactId || !inboxId || !conversationId) {
      return error('Parâmetros accountId, contactId, inboxId e conversationId são obrigatórios.', 400);
    }
    
    // Se systemAccountId não foi fornecido, buscar pelo accountId (chatwoot-account)
    let resolvedSystemAccountId = systemAccountId;
    if (!resolvedSystemAccountId) {
      console.log(`systemAccountId não fornecido, buscando via chatwoot-account=${accountId}`);
      const db = getDbConnection();
      const accountParam = await db('account_parameter')
        .select('account_id')
        .where({ name: 'chatwoot-account', value: String(accountId) })
        .first();
      
      if (!accountParam) {
        return error(`Account não encontrado para chatwoot-account=${accountId}`, 404);
      }
      
      resolvedSystemAccountId = accountParam.account_id;
      console.log(`systemAccountId resolvido: ${resolvedSystemAccountId}`);
    }
    
    // accountId é o chatwoot-account ID, resolvedSystemAccountId é o account_id do sistema
    console.log(`Iniciando atribuição para conversationId: ${conversationId} na conta Chatwoot ${accountId} (system account ${resolvedSystemAccountId})`);
    const result = await assignContactToAgent(accountId, resolvedSystemAccountId, contactId, inboxId, conversationId);
    
    console.log('Resultado da atribuição:', JSON.stringify(result, null, 2));
    return success({ message: 'Atribuição processada com sucesso', data: result });

  } catch (err) {
    console.error('Erro fatal no handler de atribuição:', err);
    return error(err.message || 'Ocorreu um erro interno ao processar a atribuição.', 500);
  }
};
