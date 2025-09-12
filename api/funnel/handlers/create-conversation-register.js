/**
 * Handler da função Lambda para criar registros de conversas de funil
 */
const { createConversationFunnelRegister } = require('../services/conversation-register-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

/**
 * Handler para criar um novo registro de conversa de funil
 * @param {Object} event - Evento de trigger do Lambda
 * @returns {Object} - Resposta formatada com dados do registro criado ou erro
 */
exports.handler = async (event) => {
  try {
    // Extrai os dados do corpo da requisição
    const registerData = JSON.parse(event.body || '{}');

    // Criar o registro de conversa de funil
    const createdRegister = await createConversationFunnelRegister(registerData);

    // Fecha a conexão com o banco de dados após o uso
    await closeDbConnection();

    // Retorna os dados com sucesso
    return success(createdRegister);
  } catch (err) {
    console.error('Erro ao criar registro de conversa de funil:', err);
    
    // Garante que a conexão com o banco seja fechada mesmo em caso de erro
    await closeDbConnection();
    
    // Determina o código de erro HTTP apropriado
    let statusCode = 500;
    if (err.message.includes('obrigatório') || err.message.includes('inválido')) {
      statusCode = 400;
    }
    
    // Retorna o erro formatado
    return error(statusCode, err.message);
  }
};
