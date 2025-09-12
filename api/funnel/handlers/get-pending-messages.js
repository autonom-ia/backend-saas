/**
 * Handler da função Lambda para buscar mensagens pendentes para uma conta
 */
const { getPendingMessages } = require('../services/pending-messages-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

/**
 * Handler para buscar mensagens pendentes para uma conta
 * @param {Object} event - Evento de trigger do Lambda
 * @returns {Object} - Resposta HTTP formatada
 */
module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido:', JSON.stringify(event));
    
    // Extrair o accountId dos parâmetros da requisição
    const accountId = event.queryStringParameters && event.queryStringParameters.accountId;
    
    // Validar se o accountId foi fornecido
    if (!accountId) {
      return error('O parâmetro accountId é obrigatório', 400);
    }
    
    console.log(`Buscando mensagens pendentes para a conta: ${accountId}`);
    
    // Buscar as mensagens pendentes
    const result = await getPendingMessages(accountId);
    
    // Retornar os dados encontrados
    return success({
      message: 'Mensagens pendentes encontradas com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao processar a requisição:', err);
    return error(err.message || 'Erro interno ao processar a requisição');
  } finally {
    // Garantir que a conexão com o banco seja fechada
    await closeDbConnection();
  }
};
