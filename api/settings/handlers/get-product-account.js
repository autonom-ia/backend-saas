/**
 * Handler da função Lambda para buscar dados de produtos e contas pelos telefones
 */
const { getProductAccountByTwoPhones } = require('../services/product-account-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

/**
 * Handler para buscar dados de produtos e contas pelos telefones
 * @param {Object} event - Evento de trigger do Lambda
 * @returns {Object} - Resposta HTTP formatada
 */
module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido:', JSON.stringify(event));
    
    // Extrair os telefones dos query parameters
    const queryParams = event.queryStringParameters || {};
    const phone = queryParams.phone;
    const accountPhone = queryParams.accountPhone;
    
    if (!phone) {
      return error('Parâmetro phone é obrigatório', 400);
    }
    
    if (!accountPhone) {
      return error('Parâmetro accountPhone é obrigatório', 400);
    }
    
    console.log(`Buscando dados para phone: ${phone}, accountPhone: ${accountPhone}`);
    
    // Buscar dados no serviço com a nova lógica
    const data = await getProductAccountByTwoPhones(phone, accountPhone);
    
    // Estruturar a resposta (formato mantido igual)
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
