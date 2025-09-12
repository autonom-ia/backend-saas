/**
 * Handler para atribuir contatos automaticamente a agentes disponíveis
 */

const { assignContactToAgent } = require('../services/assign-service');

const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido para atribuição:', JSON.stringify(event, null, 2));
    
    const body = JSON.parse(event.body || '{}');
    const { accountId, contactId, inboxId, conversationId } = body;
    
    if (!accountId || !contactId || !inboxId || !conversationId) {
      return error('Parâmetros accountId, contactId, inboxId e conversationId são obrigatórios.', 400);
    }
    
    console.log(`Iniciando atribuição para conversationId: ${conversationId} na conta ${accountId}`);
    const result = await assignContactToAgent(accountId, contactId, inboxId, conversationId);
    
    console.log('Resultado da atribuição:', JSON.stringify(result, null, 2));
    return success({ message: 'Atribuição processada com sucesso', data: result });

  } catch (err) {
    console.error('Erro fatal no handler de atribuição:', err);
    return error(err.message || 'Ocorreu um erro interno ao processar a atribuição.', 500);
  }
};
