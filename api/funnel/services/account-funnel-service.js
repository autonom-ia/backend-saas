/**
 * Serviço para buscar dados de funis de conversação relacionados a contas
 */
const { getDbConnection } = require('../utils/database');
const { getCache, setCache } = require('../utils/cache');

/**
 * Busca dados da conta, funil de conversação e etapas associadas pelo ID da conta
 * @param {string} accountId - ID da conta para filtrar os dados
 * @returns {Object} - Objeto contendo dados da conta e funil de conversação associado
 */
const getAccountFunnelData = async (accountId) => {
  const cacheKey = `account-funnel:${accountId}`;
  
  // Tenta obter dados do cache
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  
  // Se não encontrar no cache, busca no banco de dados
  const db = await getDbConnection();
  
  // Busca os dados da conta pelo ID, incluindo a referência ao funil de conversação
  const accountData = await db('account')
    .where('id', accountId)
    .first();
  
  if (!accountData) {
    throw new Error(`Conta não encontrada para o ID: ${accountId}`);
  }
  
  // Busca o parâmetro team-id na tabela account_parameter
  const teamIdParam = await db('account_parameter')
    .where({
      account_id: accountId,
      name: 'team-id'
    })
    .first();
  
  // Adiciona o parâmetro team-id aos dados da conta se existir
  if (teamIdParam) {
    accountData.teamId = teamIdParam.value;
  }
  
  // Verifica se a conta tem um funil associado
  if (!accountData.conversation_funnel_id) {
    // Log para debug
    console.log(`Conta ${accountId} sem funil associado. Dados da conta:`, {
      ...accountData,
      teamId: accountData.teamId || 'não definido'
    });
    
    return {
      account: accountData,
      conversationFunnel: null,
      steps: []
    };
  }
  
  // Busca os dados do funil de conversação associado à conta
  const conversationFunnel = await db('conversation_funnel')
    .where('id', accountData.conversation_funnel_id)
    .first();
  
  if (!conversationFunnel) {
    throw new Error(`Funil de conversação não encontrado para o ID: ${accountData.conversation_funnel_id}`);
  }
  
  // Busca as etapas do funil
  const steps = await db('conversation_funnel_step')
    .where('conversation_funnel_id', conversationFunnel.id)
    .select('*');
    
  // Para cada etapa do funil, busca as mensagens associadas
  const stepsWithMessages = await Promise.all(
    steps.map(async (step) => {
      const messages = await db('conversation_funnel_step_message')
        .where('conversation_funnel_step_id', step.id)
        .orderBy('shipping_order', 'asc')
        .select('*');
      
      return {
        ...step,
        messages
      };
    })
  );
  
  // Monta o objeto de resposta
  const result = {
    account: accountData,
    conversationFunnel,
    steps: stepsWithMessages
  };
  
  // Salva os dados no cache
  await setCache(cacheKey, JSON.stringify(result), 60 * 5); // 5 minutos de TTL
  
  return result;
};

module.exports = {
  getAccountFunnelData
};
