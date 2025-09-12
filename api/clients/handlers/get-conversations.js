const { getConversations } = require('../services/conversation-service');
const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido para buscar conversas:', JSON.stringify(event, null, 2));

    const { accountId, startDate, endDate } = event.queryStringParameters || {};

    if (!accountId || !startDate || !endDate) {
      return error('Parâmetros accountId, startDate e endDate são obrigatórios.', 400);
    }

    console.log(`Iniciando busca de conversas para a conta ${accountId} entre ${startDate} e ${endDate}`);
    const result = await getConversations(accountId, startDate, endDate);

    console.log('Resultado da busca:', JSON.stringify(result, null, 2));
    return success({ message: 'Busca de conversas realizada com sucesso', data: result });

  } catch (err) {
    console.error('Erro fatal no handler de busca de conversas:', err);
    return error(err.message || 'Ocorreu um erro interno ao processar a busca.', 500);
  }
};
