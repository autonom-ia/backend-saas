/**
 * Serviço para gerenciar mensagens pendentes do funil de conversação
 */
const { getDbConnection } = require('../utils/database');
const { formatParameters } = require('../utils/format-parameters');

/**
 * Busca os dados da conta pelo ID
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} accountId - ID da conta
 * @returns {Promise<Object>} - Dados da conta
 */
const getAccountData = async (db, accountId) => {
  const account = await db('account')
    .where('id', accountId)
    .first();

  if (!account) {
    throw new Error(`Conta não encontrada para o ID: ${accountId}`);
  }

  return account;
};

/**
 * Busca os parâmetros da conta
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} accountId - ID da conta
 * @returns {Promise<Array>} - Lista de parâmetros da conta
 */
const getAccountParameters = async (db, accountId) => {
  return await db('account_parameter')
    .where('account_id', accountId)
    .select('*');
};

/**
 * Busca o funil de conversação associado à conta
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} funnelId - ID do funil
 * @returns {Promise<Object>} - Dados do funil de conversação
 */
const getConversationFunnel = async (db, funnelId) => {
  if (!funnelId) return null;

  const funnel = await db('conversation_funnel')
    .where('id', funnelId)
    .select('id', 'name', 'description', 'created_at') // Excluindo agent_instruction e selecionando apenas colunas existentes
    .first();

  return funnel || null;
};

/**
 * Busca todas as etapas do funil e suas mensagens onde shipping_time > 0
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} funnelId - ID do funil de conversação
 * @returns {Promise<Object>} - Objeto com etapas e mensagens separadamente
 */
const getFunnelStepsWithScheduledMessages = async (db, funnelId) => {
  if (!funnelId) return { steps: [], messages: [] };

  // Busca todas as etapas do funil excluindo agent_instruction
  const steps = await db('conversation_funnel_step')
    .where('conversation_funnel_id', funnelId)
    .select(
      'id', 'name', 'description', 'conversation_funnel_id', 'created_at'
    );

  // Preparar um objeto para armazenar mensagens por stepId
  const messagesByStepId = {};
  
  // Para cada etapa, busca as mensagens com shipping_time > 0
  for (const step of steps) {
    const messages = await db('conversation_funnel_step_message')
      .where('conversation_funnel_step_id', step.id)
      .where('shipping_time', '>', 0)
      .orderBy('shipping_order', 'asc')
      .select('*');
    
    if (messages.length > 0) {
      messagesByStepId[step.id] = messages;
    }
  }
  
  // Filtra apenas as etapas que têm mensagens programadas
  const stepsWithMessages = steps.filter(step => messagesByStepId[step.id]);
  
  return {
    steps: stepsWithMessages,
    messagesByStepId
  };
};

/**
 * Busca as sessões de usuário que estão na etapa especificada com last_access antigo
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} stepId - ID da etapa do funil
 * @param {number} minutesThreshold - Limite de minutos para considerar o last_access como antigo
 * @returns {Promise<Array>} - Lista de sessões de usuário que não tiveram acesso recente
 */
const getUserSessionsForStepWithInactivity = async (db, stepId, minutesThreshold) => {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - (minutesThreshold * 60 * 1000));
  
  return await db('user_session')
    .where('conversation_funnel_step_id', stepId)
    .where('last_access', '<', thresholdDate)
    .select('*');
};

/**
 * Verifica se uma mensagem já foi enviada para uma sessão de usuário
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} userSessionId - ID da sessão do usuário
 * @param {string} conversationFunnelStepMessageId - ID da mensagem do passo do funil
 * @returns {Promise<boolean>} - true se a mensagem já foi enviada, false caso contrário
 */
const hasMessageBeenSent = async (db, userSessionId, conversationFunnelStepMessageId) => {
  try {
    const sentMessage = await db('user_session_conversation_funnel_step_message')
      .where({
        user_session_id: userSessionId,
        conversation_funnel_step_message_id: conversationFunnelStepMessageId
      })
      .first();
    
    return !!sentMessage;
  } catch (error) {
    console.error('Erro ao verificar se mensagem foi enviada:', error);
    return false;
  }
};

/**
 * Busca os parâmetros de webhook do produto associado à conta
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} productId - ID do produto
 * @returns {Promise<Object>} - Objeto com URLs dos webhooks ou null se não encontrados
 */
const getAgentWebhooks = async (db, productId) => {
  if (!productId) return { agent_webhook: null, funnel_agent_webhook: null };
  
  try {
    // Buscar ambos os parâmetros em uma única consulta
    const webhookParams = await db('product_parameter')
      .where('product_id', productId)
      .whereIn('name', ['agent_webhook', 'funnel_agent_webhook'])
      .select('name', 'value');
    
    // Inicializar objeto de retorno
    const webhooks = {
      agent_webhook: null,
      funnel_agent_webhook: null
    };
    
    // Preencher valores encontrados
    webhookParams.forEach(param => {
      webhooks[param.name] = param.value;
    });
    
    return webhooks;
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error);
    return { agent_webhook: null, funnel_agent_webhook: null };
  }
};

/**
 * Busca o registro de conversa mais recente para a sessão e etapa do funil
 * @param {Object} db - Conexão com o banco de dados
 * @param {string} userSessionId - ID da sessão de usuário
 * @param {string} stepId - ID da etapa do funil
 * @returns {Promise<Object>} - Registro de conversa mais recente
 */
const getLatestConversationRegister = async (db, userSessionId, stepId) => {
  return await db('conversation_funnel_register')
    .where({
      user_session_id: userSessionId,
      conversation_funnel_step_id: stepId
    })
    .orderBy('created_at', 'desc')
    .first();
};

/**
 * Busca mensagens pendentes para envio para uma conta
 * @param {string} accountId - ID da conta para buscar mensagens pendentes
 * @returns {Promise<Object>} - Objeto com os dados da conta e mensagens pendentes
 */
const getPendingMessages = async (accountId) => {
  if (!accountId) {
    throw new Error('ID da conta é obrigatório');
  }

  // Conexão com o banco
  const db = await getDbConnection();
  
  try {
    // Busca dados da conta
    const account = await getAccountData(db, accountId);
    
    // Busca parâmetros da conta (array)
    const accountParametersArray = await getAccountParameters(db, accountId);
    
    // Formata accountParameters para objeto { nome: valor }
    const accountParameters = formatParameters(accountParametersArray);
    
    // Busca URLs dos webhooks do agente nos parâmetros do produto
    const webhooks = await getAgentWebhooks(db, account.product_id);
    
    // Array para armazenar mensagens pendentes
    const pendingMessages = [];

    // Se a conta não tem funil associado, retorna dados vazios
    if (!account.conversation_funnel_id) {
      return {
        account,
        accountParameters,
        agent_webhook: webhooks.agent_webhook,
        funnel_agent_webhook: webhooks.funnel_agent_webhook,
        messages: pendingMessages
      };
    }
    
    // Busca o funil de conversação
    const conversationFunnel = await getConversationFunnel(db, account.conversation_funnel_id);
    
    if (!conversationFunnel) {
      return {
        account,
        accountParameters,
        agent_webhook: webhooks.agent_webhook,
        funnel_agent_webhook: webhooks.funnel_agent_webhook,
        messages: pendingMessages
      };
    }
    
    // Busca etapas do funil com mensagens programadas (shipping_time > 0)
    const { steps, messagesByStepId } = await getFunnelStepsWithScheduledMessages(db, conversationFunnel.id);
    
    // Para cada etapa com mensagens programadas
    for (const step of steps) {
      // Para cada mensagem associada a esta etapa
      for (const message of messagesByStepId[step.id]) {
        // Busca sessões na etapa atual com last_access antigo (baseado no shipping_time da mensagem)
        const userSessions = await getUserSessionsForStepWithInactivity(
          db, 
          step.id, 
          message.shipping_time
        );
        
        // Para cada sessão, verifica se a mensagem ainda não foi enviada
        for (const userSession of userSessions) {
          const messageAlreadySent = await hasMessageBeenSent(
            db, 
            userSession.id, 
            message.id
          );
          
          // Se a mensagem já foi enviada, pula para próxima sessão
          if (messageAlreadySent) {
            continue;
          }
          
          // Busca o registro de conversa mais recente para essa sessão e etapa
          const conversationRegister = await getLatestConversationRegister(
            db, 
            userSession.id, 
            step.id
          );
          
          // Adiciona à lista de mensagens pendentes
          pendingMessages.push({
            conversation_funnel: conversationFunnel, // agent_instruction já foi excluído na função getConversationFunnel
            conversation_funnel_step: step, // agent_instruction já foi excluído e não contém o array messages
            conversation_funnel_step_message: message,
            user_session: userSession,
            conversation_funnel_register: conversationRegister || null
          });
          
          // Como só queremos uma mensagem por user_session, interrompe o loop de mensagens
          break;
        }
      }
    }
    
    // Ao final, retorna os dados coletados
    return {
      account,
      accountParameters,
      agent_webhook: webhooks.agent_webhook,
      funnel_agent_webhook: webhooks.funnel_agent_webhook,
      messages: pendingMessages
    };
  } catch (error) {
    console.error('Erro ao buscar mensagens pendentes:', error);
    throw new Error(`Erro ao buscar mensagens pendentes: ${error.message}`);
  } finally {
    if (db) {
      db.destroy();
    }
  }
};

module.exports = {
  getPendingMessages,
  getAgentWebhooks // Exportando a função renomeada para uso em outros módulos se necessário
};
