/**
 * Handler para desalocar contatos inativos dos atendentes do Chatwoot
 */
const { unassignInactiveContacts } = require('../services/unassign-service');
const { success, error } = require('../utils/response');

/**
 * Handler para desalocar contatos inativos dos atendentes do Chatwoot
 * @param {Object} event - Evento da requisição
 * @returns {Object} - Resposta da API
 */
module.exports.handler = async (event) => {
  console.log('Iniciando processo de desalocação de contatos inativos');
  
  try {
    // Executar o serviço para desalocar contatos inativos
    const result = await unassignInactiveContacts();
    
    // Retornar resposta de sucesso
    return success({
      message: 'Processo de desalocação de contatos inativos concluído com sucesso',
      data: result
    });
  } catch (err) {
    console.error('Erro ao desalocar contatos inativos:', err);
    return error(err.message || 'Erro interno ao processar a requisição');
  }
};
