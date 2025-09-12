/**
 * Handler da função Lambda para buscar dados de produto e conta pelo telefone da conta
 */
const { getProductAccountbyAccountPhone } = require('../services/product-account-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

/**
 * Handler para buscar dados de produto e conta pelo telefone da conta
 * 
 * @param {Object} event - Evento de requisição Lambda
 * @param {Object} context - Contexto Lambda
 * @returns {Object} - Resposta formatada 
 */
module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido:', JSON.stringify(event));

    // Extrair parâmetros da query string
    const queryParams = event.queryStringParameters || {};
    const accountPhone = queryParams.accountPhone;

    // Validar parâmetros obrigatórios
    if (!accountPhone) {
      return error('Parâmetro accountPhone é obrigatório', 400);
    }

    console.log(`Buscando dados para accountPhone: ${accountPhone}`);
    
    // Chamar o serviço para buscar os dados
    const data = await getProductAccountbyAccountPhone(accountPhone);
    
    // Retornar resposta de sucesso
    return success({
      message: 'Dados recuperados com sucesso',
      data
    });
  } catch (err) {
    console.error('Erro ao processar a requisição:', err);
    return error(err.message || 'Erro interno ao processar a requisição');
  } finally {
    // Garantir que a conexão com o banco seja fechada
    await closeDbConnection();
  }
};


