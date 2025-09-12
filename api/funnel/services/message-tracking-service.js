/**
 * Serviço para gerenciar o registro de mensagens enviadas do funil para sessões de usuários
 */
const { getDbConnection } = require('../utils/database');

/**
 * Registra que uma mensagem de etapa do funil foi enviada para uma sessão de usuário
 * 
 * @param {string} conversationFunnelStepMessageId - ID da mensagem de etapa do funil
 * @param {string} userSessionId - ID da sessão do usuário
 * @returns {Object} - Dados do registro criado
 */
const registerSentMessage = async (conversationFunnelStepMessageId, userSessionId) => {
  if (!conversationFunnelStepMessageId) {
    throw new Error('ID da mensagem de etapa do funil é obrigatório');
  }
  
  if (!userSessionId) {
    throw new Error('ID da sessão do usuário é obrigatório');
  }

  // Conexão com o banco
  const db = await getDbConnection();
  
  try {
    // Verifica se a mensagem existe
    const messageExists = await db('conversation_funnel_step_message')
      .where('id', conversationFunnelStepMessageId)
      .first();
    
    if (!messageExists) {
      throw new Error(`Mensagem de etapa do funil com ID ${conversationFunnelStepMessageId} não encontrada`);
    }
    
    // Verifica se a sessão do usuário existe
    const sessionExists = await db('user_session')
      .where('id', userSessionId)
      .first();
    
    if (!sessionExists) {
      throw new Error(`Sessão de usuário com ID ${userSessionId} não encontrada`);
    }
    
    // Verifica se já existe um registro para essa combinação
    const existingRecord = await db('user_session_conversation_funnel_step_message')
      .where({
        conversation_funnel_step_message_id: conversationFunnelStepMessageId,
        user_session_id: userSessionId
      })
      .first();
    
    if (existingRecord) {
      // Se já existe, apenas retorna o registro existente
      return existingRecord;
    }
    
    // Cria o novo registro
    const [result] = await db('user_session_conversation_funnel_step_message')
      .insert({
        conversation_funnel_step_message_id: conversationFunnelStepMessageId,
        user_session_id: userSessionId,
        created_at: new Date()
      })
      .returning('*');
    
    return result;
  } catch (error) {
    console.error('Erro ao registrar mensagem enviada:', error);
    throw new Error(`Erro ao registrar mensagem enviada: ${error.message}`);
  } finally {
    if (db) {
      db.destroy();
    }
  }
};

/**
 * Verifica se uma mensagem de etapa do funil já foi enviada para uma sessão de usuário
 * 
 * @param {string} conversationFunnelStepMessageId - ID da mensagem de etapa do funil
 * @param {string} userSessionId - ID da sessão do usuário
 * @returns {boolean} - true se a mensagem já foi enviada, false caso contrário
 */
const checkMessageSent = async (conversationFunnelStepMessageId, userSessionId) => {
  if (!conversationFunnelStepMessageId || !userSessionId) {
    return false;
  }

  // Conexão com o banco
  const db = await getDbConnection();
  
  try {
    // Busca registro
    const record = await db('user_session_conversation_funnel_step_message')
      .where({
        conversation_funnel_step_message_id: conversationFunnelStepMessageId,
        user_session_id: userSessionId
      })
      .first();
    
    return !!record; // Converte para booleano
  } catch (error) {
    console.error('Erro ao verificar mensagem enviada:', error);
    throw new Error(`Erro ao verificar mensagem enviada: ${error.message}`);
  } finally {
    if (db) {
      db.destroy();
    }
  }
};

module.exports = {
  registerSentMessage,
  checkMessageSent
};
