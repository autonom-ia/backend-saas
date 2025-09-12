/**
 * Handler para criar uma nova sessão de usuário
 */
const { createUserSession } = require('../services/user-session-service');
const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido para criar sessão de usuário:', JSON.stringify(event, null, 2));
    
    const body = JSON.parse(event.body || '{}');
    
    // Os dados da sessão são o próprio corpo da requisição
    const sessionData = body;
    
    // A validação dos campos obrigatórios é feita no serviço
    const result = await createUserSession(sessionData);
    
    console.log('Resultado da criação da sessão:', JSON.stringify(result, null, 2));
    return success({ message: 'Sessão de usuário processada com sucesso', data: result });

  } catch (err) {
    console.error('Erro fatal no handler de criação de sessão:', err);
    return error(err.message || 'Ocorreu um erro interno ao processar a sessão.', 500);
  }
};
