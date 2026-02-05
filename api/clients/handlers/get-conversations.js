const { getConversations } = require('../services/conversation-service');
const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido para buscar conversas:', JSON.stringify(event, null, 2));

    const { accountId, productId, startDate, endDate } = event.queryStringParameters || {};

    if (!accountId) {
      return error('Parâmetro accountId é obrigatório.', 400);
    }

    if (!productId) {
      return error('Parâmetro productId é obrigatório.', 400);
    }

    if (!startDate || !endDate) {
      return error('Parâmetros startDate e endDate são obrigatórios.', 400);
    }

    console.log(`Iniciando busca de conversas para a conta ${accountId}, produto ${productId}, entre ${startDate} e ${endDate}`);
    const result = await getConversations(accountId, productId, startDate, endDate);

    console.log('Resultado da busca:', JSON.stringify(result, null, 2));
    return success({ message: 'Busca de conversas realizada com sucesso', data: result });

  } catch (err) {
    console.error('Erro fatal no handler de busca de conversas:', err);
    return error(err.message || 'Ocorreu um erro interno ao processar a busca.', 500);
  }
};
