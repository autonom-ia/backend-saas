/**
 * Handler para registrar uma mensagem de etapa do funil enviada para uma sessão de usuário
 */
const { registerSentMessage } = require('../services/message-tracking-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

/**
 * Handler para registrar mensagem enviada
 * 
 * @param {Object} event - Evento de requisição Lambda
 * @param {Object} context - Contexto Lambda
 * @returns {Object} - Resposta formatada 
 */
const handler = async (event, context) => {
  try {
    // Extrai dados do corpo da requisição
    const requestBody = JSON.parse(event.body || '{}');
    
    // Extrai campos necessários
    const { conversationFunnelStepMessageId, userSessionId } = requestBody;
    
    if (!conversationFunnelStepMessageId) {
      return error('ID da mensagem de etapa do funil é obrigatório', 400);
    }
    
    if (!userSessionId) {
      return error('ID da sessão do usuário é obrigatório', 400);
    }
    
    // Registra a mensagem como enviada
    const result = await registerSentMessage(conversationFunnelStepMessageId, userSessionId);
    
    // Retorna sucesso
    return success({
      message: 'Mensagem registrada com sucesso',
      data: result
    }, 201);
  } catch (err) {
    console.error('Erro ao registrar mensagem:', err);
    return error(`Erro ao registrar mensagem: ${err.message}`);
  } finally {
    // Garantir que a conexão com o banco seja fechada
    await closeDbConnection();
  }
};

module.exports = { handler };
