/**
 * Handler da função Lambda para listar contas com produtos e parâmetros
 */
const { listAccounts } = require('../services/account-list-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

/**
 * Handler para listar contas com produtos e parâmetros
 * @param {Object} event - Evento de requisição Lambda
 * @returns {Object} - Resposta formatada 
 */
module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido:', JSON.stringify(event));

    // Extrair parâmetros da query string
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 50;
    const offset = parseInt(queryParams.offset) || 0;

    // Validar parâmetros
    if (limit > 100) {
      return error('Limite máximo permitido é 100 registros', 400);
    }

    console.log(`Listando contas com limit: ${limit}, offset: ${offset}`);
    
    // Chamar o serviço para buscar os dados
    const data = await listAccounts(limit, offset);
    
    // Retornar resposta de sucesso
    return success({
      message: 'Contas listadas com sucesso',
      data,
      pagination: {
        limit,
        offset,
        count: data.length
      }
    });
  } catch (err) {
    console.error('Erro ao processar a requisição:', err);
    return error(err.message || 'Erro interno ao processar a requisição');
  } finally {
    // Garantir que a conexão com o banco seja fechada
    await closeDbConnection();
  }
};
