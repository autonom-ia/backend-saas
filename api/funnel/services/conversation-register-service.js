/**
 * Serviço para operações com registros de conversas de funil
 */
const { getDbConnection } = require('../utils/database');
const { getCache, setCache, invalidateCache } = require('../utils/cache');
const { createKanbanItem, updateKanbanItem } = require('./kanban-items-service');

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

    // Criar/Atualizar item no kanban para a user_session
    if (registerData.user_session_id) {
      try {
        // Resolver dados necessários
        const userSessionId = registerData.user_session_id;
        const summary = registerData.summary || null;
        const priority = registerData.priority || null;
        const funnelStageId = registerData.conversation_funnel_step_id || null;

        // Buscar funnel_id via conversation_funnel_step se informado
        let funnelId = null;
        if (funnelStageId) {
          const step = await db('conversation_funnel_step')
            .select('conversation_funnel_id')
            .where('id', funnelStageId)
            .first();
          funnelId = step ? step.conversation_funnel_id : null;
        }

        // Garantir account_id (do payload ou via user_session)
        let accountId = registerData.account_id || null;
        if (!accountId) {
          const us = await db('user_session').select('account_id').where('id', userSessionId).first();
          accountId = us ? us.account_id : null;
        }

        // Fallback de funnel_id através da account, se necessário
        if (!funnelId && accountId) {
          const acc = await db('account').select('conversation_funnel_id').where('id', accountId).first();
          funnelId = acc ? acc.conversation_funnel_id : null;
        }

        // Verificar se já existe item para a user_session
        const existing = await db('kanban_items')
          .where({ user_session_id: userSessionId })
          .first();

        const now = new Date();
        if (existing) {
          await updateKanbanItem(existing.id, {
            summary,
            funnel_stage_id: funnelStageId,
            conversation_funnel_register_id: createdRegister.id,
            timer_started_at: now,
            priority,
          });
        } else if (accountId && funnelId && funnelStageId) {
          await createKanbanItem({
            account_id: accountId,
            funnel_id: funnelId,
            funnel_stage_id: funnelStageId,
            user_session_id: userSessionId,
            position: 0,
            summary,
            title: summary || 'Kanban Item',
            timer_started_at: now,
            priority,
            conversation_funnel_register_id: createdRegister.id,
          });
        } else {
          console.warn('Não foi possível criar kanban_items: campos obrigatórios ausentes', {
            accountId,
            funnelId,
            funnelStageId,
          });
        }
      } catch (kanbanError) {
        console.error('Erro ao criar/atualizar kanban_items para user_session:', kanbanError);
      }
    }

    // Se assign_to_team na etapa do funil for true, chamar Autonomia/Clients/AssignContacts
    try {
      const stepId = registerData.conversation_funnel_step_id;
      if (stepId) {
        const step = await db('conversation_funnel_step')
          .select('assign_to_team')
          .where('id', stepId)
          .first();
        if (step && step.assign_to_team) {
          // Obter dados necessários a partir da user_session
          const us = await db('user_session')
            .select('account_id', 'contact_id', 'inbox_id', 'conversation_id')
            .where('id', registerData.user_session_id)
            .first();
          if (us && us.account_id && us.contact_id && us.inbox_id && us.conversation_id) {
            const payload = {
              accountId: us.account_id,
              contactId: us.contact_id,
              inboxId: us.inbox_id,
              conversationId: us.conversation_id,
            };
            const url = 'https://api-clients.autonomia.site/Autonomia/Clients/AssignContacts';
            try {
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!resp.ok) {
                const text = await resp.text();
                console.error('AssignContacts falhou', resp.status, text);
              } else {
                console.log('AssignContacts chamado com sucesso para conversation', us.conversation_id);
              }
            } catch (httpErr) {
              console.error('Erro HTTP ao chamar AssignContacts:', httpErr);
            }
          } else {
            console.warn('Dados insuficientes em user_session para AssignContacts', us);
          }
        }
      }
    } catch (assignErr) {
      console.error('Erro ao processar assign_to_team:', assignErr);
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
