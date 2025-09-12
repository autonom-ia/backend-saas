/**
 * Serviço para operações com registros de conversas de funil
 */
const { getDbConnection } = require('../utils/database');
const { getCache, setCache, invalidateCache } = require('../utils/cache');

/**
 * Cria um novo registro de conversa de funil
 * @param {Object} registerData - Dados para criar o registro
 * @param {string} [registerData.user_session_id] - ID da sessão do usuário
 * @param {string} [registerData.product_id] - ID do produto
 * @param {string} [registerData.account_id] - ID da conta
 * @param {string} [registerData.chatwoot_account] - Conta do Chatwoot
 * @param {string} [registerData.chatwoot_inbox] - Caixa de entrada do Chatwoot
 * @param {string} [registerData.chatwoot_conversations] - Conversas do Chatwoot
 * @param {string} [registerData.conversation_funnel_step_id] - ID da etapa do funil de conversação
 * @param {string} [registerData.summary] - Resumo da conversa
 * @param {Date} [registerData.last_timestamptz] - Timestamp da última atualização
 * @param {string[]} [registerData.declared_interests] - Interesses declarados
 * @param {string[]} [registerData.mentioned_products] - Produtos mencionados
 * @param {string[]} [registerData.points_attention_objections] - Pontos de atenção/objeções
 * @returns {Object} - Registro criado
 */
const createConversationFunnelRegister = async (registerData) => {
  // Validar dados mínimos necessários
  if (!registerData) {
    throw new Error('Dados de registro são obrigatórios');
  }

  // Obter conexão com o banco
  const db = await getDbConnection();
  
  try {
    // Processar dados para conversão de arrays para strings JSON
    const processedData = { ...registerData };
    
    // Converter campos que eram arrays para strings JSON
    if (Array.isArray(processedData.declared_interests)) {
      processedData.declared_interests = JSON.stringify(processedData.declared_interests);
    }
    
    if (Array.isArray(processedData.mentioned_products)) {
      processedData.mentioned_products = JSON.stringify(processedData.mentioned_products);
    }
    
    if (Array.isArray(processedData.points_attention_objections)) {
      processedData.points_attention_objections = JSON.stringify(processedData.points_attention_objections);
    }

    // Inserir o registro na tabela
    const [createdRegister] = await db('conversation_funnel_register')
      .insert(processedData)
      .returning('*');
    
    if (!createdRegister) {
      throw new Error('Falha ao criar registro de conversa de funil');
    }
    
    // Atualizar a tabela user_session se user_session_id estiver presente
    if (registerData.user_session_id) {
      try {
        // Atualizar last_access com a hora atual e conversation_funnel_step_id
        const now = new Date();
        await db('user_session')
          .where('id', registerData.user_session_id)
          .update({
            last_access: now,
            conversation_funnel_step_id: registerData.conversation_funnel_step_id || null
          });
        
        console.log(`User session ${registerData.user_session_id} atualizada com sucesso.`);
      } catch (updateError) {
        // Apenas logamos o erro, não queremos que falhe o processo inteiro
        console.error(`Erro ao atualizar user_session ${registerData.user_session_id}:`, updateError);
      }
    }
    
    // Invalidar cache se necessário (opcional, dependendo da lógica de negócio)
    if (registerData.account_id) {
      const cacheKey = `account-funnel:${registerData.account_id}`;
      await invalidateCache(cacheKey);
    }
    
    return createdRegister;
  } catch (error) {
    console.error('Erro ao criar registro de conversa de funil:', error);
    throw error;
  }
};

module.exports = {
  createConversationFunnelRegister
};
