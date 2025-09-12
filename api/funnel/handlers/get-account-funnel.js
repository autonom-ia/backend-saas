/**
 * Handler da função Lambda para buscar dados de funis de conversação por ID da conta
 */
const { getAccountFunnelData } = require('../services/account-funnel-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

/**
 * Handler para buscar dados de funis de conversação por ID da conta
 * @param {Object} event - Evento de trigger do Lambda
 * @returns {Object} - Resposta formatada com dados dos funis ou erro
 */
exports.handler = async (event) => {
  try {
    // Extrai o accountId da query string
    const { accountId } = event.queryStringParameters || {};

    if (!accountId) {
      return error(400, 'O parâmetro accountId é obrigatório');
    }

    // Busca os dados de funis de conversação para a conta
    const funnelData = await getAccountFunnelData(accountId);

    // Fecha a conexão com o banco de dados após o uso
    await closeDbConnection();

    // Retorna os dados com sucesso
    return success(funnelData);
  } catch (err) {
    console.error('Erro ao buscar dados do funil:', err);
    
    // Tenta fechar a conexão com o banco em caso de erro
    try {
      await closeDbConnection();
    } catch (dbError) {
      console.error('Erro ao fechar conexão com o banco:', dbError);
    }

    return error(500, `Erro ao buscar dados do funil: ${err.message}`);
  }
};
