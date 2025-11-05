/**
 * Serviço para operações com registros de conversas de funil
 */
const { getDbConnection } = require('../utils/database');
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
    // Cache removido para evitar dependência de VPC/Redis nesta rota

    // Criar/Atualizar item no kanban para a user_session
    if (registerData.user_session_id) {
      try {
        // Resolver dados necessários
        const userSessionId = registerData.user_session_id;
        const summary = registerData.summary || null;
        const priority = registerData.priority || null;
        const funnelStageId = registerData.conversation_funnel_step_id || null;
        // Obter o nome/telefone da user_session para usar como título do Kanban
        let userSessionName = null;
        let userSessionPhone = null;
        try {
          if (userSessionId) {
            const usRow = await db('user_session')
              .select('name', 'phone')
              .where('id', userSessionId)
              .first();
            userSessionName = (usRow && usRow.name) ? usRow.name : null;
            userSessionPhone = (usRow && usRow.phone) ? usRow.phone : null;
          }
        } catch (e) {
          console.warn('Não foi possível obter name da user_session para título do Kanban:', e?.message || e);
        }

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
            title: userSessionName || userSessionPhone || 'Kanban Item',
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

    // Backfill inbox_id / conversation_id a partir do body se ausentes e persistir
    try {
      let us = await db('user_session')
        .select('id', 'account_id', 'contact_id', 'inbox_id', 'conversation_id')
        .where('id', registerData.user_session_id)
        .first();

      const updates = {};
      if (!us?.inbox_id && registerData.chatwoot_inbox) {
        const parsedInbox = parseInt(registerData.chatwoot_inbox, 10);
        if (!Number.isNaN(parsedInbox)) updates.inbox_id = parsedInbox;
      }
      if (!us?.conversation_id && registerData.chatwoot_conversations) {
        const parsedConv = parseInt(registerData.chatwoot_conversations, 10);
        if (!Number.isNaN(parsedConv)) updates.conversation_id = parsedConv;
      }
      if (Object.keys(updates).length > 0) {
        await db('user_session').where('id', us.id).update(updates);
        console.log('Backfill executado para user_session:', us.id, updates);
        // Recarregar us com valores atualizados
        us = await db('user_session')
          .select('id', 'account_id', 'contact_id', 'inbox_id', 'conversation_id')
          .where('id', registerData.user_session_id)
          .first();
      }
    } catch (backfillErr) {
      console.error('Erro ao executar backfill inbox_id/conversation_id:', backfillErr);
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
          // Montar payload priorizando valores do body quando presentes
          const chatwootAccountId = registerData.chatwoot_account;
          const inboxId = registerData.chatwoot_inbox;
          const conversationId = registerData.chatwoot_conversations;
          const contactId = registerData.chatwoot_contact;
          
          // Obter systemAccountId a partir do registerData
          let systemAccountId = registerData.account_id;
          if (!systemAccountId && registerData.user_session_id) {
            const us = await db('user_session').select('account_id').where('id', registerData.user_session_id).first();
            systemAccountId = us ? us.account_id : null;
          }

          if (chatwootAccountId && systemAccountId && contactId && inboxId && conversationId) {
            const payload = {
              accountId: chatwootAccountId,
              systemAccountId,
              contactId,
              inboxId,
              conversationId,
            };
            const url = 'https://api-clients.autonomia.site/Autonomia/Clients/AssignContacts';
            
            // Log do request
            console.log('[AssignContacts] REQUEST:', {
              url,
              method: 'POST',
              payload
            });
            
            try {
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              
              const responseText = await resp.text();
              let responseData;
              try {
                responseData = JSON.parse(responseText);
              } catch {
                responseData = responseText;
              }
              
              // Log do response
              console.log('[AssignContacts] RESPONSE:', {
                status: resp.status,
                statusText: resp.statusText,
                headers: Object.fromEntries(resp.headers.entries()),
                body: responseData
              });
              
              if (!resp.ok) {
                console.error('[AssignContacts] Falhou com status', resp.status, responseData);
              } else {
                console.log('[AssignContacts] Sucesso para conversation', conversationId);
              }
            } catch (httpErr) {
              console.error('[AssignContacts] Erro HTTP:', httpErr.message, httpErr.stack);
            }
          } else {
            console.warn('Dados insuficientes para AssignContacts', {
              chatwootAccountId,
              systemAccountId,
              contactId,
              inboxId,
              conversationId,
            });
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
