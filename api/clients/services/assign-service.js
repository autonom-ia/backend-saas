/**
 * Serviço para atribuição automática de contatos a agentes disponíveis
 */

const axios = require('axios');
const knex = require('knex');
const { getDbConnection } = require('../utils/database');

// Configuração da conexão com o banco de dados clients
const clientsDb = knex({
  client: 'pg',
  connection: {
    host: process.env.CLIENTS_DB_HOST,
    port: process.env.CLIENTS_DB_PORT,
    database: process.env.CLIENTS_DB_NAME,
    user: process.env.CLIENTS_DB_USER,
    password: process.env.CLIENTS_DB_PASSWORD,
    ssl: process.env.CLIENTS_DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  pool: { min: 0, max: 5 }
});

// Fallback padrão quando não há agente disponível
const DEFAULT_ASSIGNEE_ID = 1;

/**
 * Cria conexão com banco de dados do Chatwoot usando account_id
 * @param {number} systemAccountId - ID da conta no sistema
 * @returns {Promise<knex>} - Conexão Knex com o banco do Chatwoot
 */
async function createChatwootDbConnection(systemAccountId) {
  try {
    const db = getDbConnection();
    console.log(`Buscando configuração do Chatwoot para account_id: ${systemAccountId}`);

    const hostParam = await db('account_parameter')
      .select('value')
      .where({ account_id: systemAccountId, name: 'chatwoot_db_host' })
      .first();

    if (!hostParam || !hostParam.value) {
      throw new Error(`Parâmetro 'chatwoot_db_host' não encontrado para account_id=${systemAccountId}`);
    }

    const host = hostParam.value;
    const port = 5432;
    const name = 'chatwoot';
    const user = 'postgres';
    const password = 'Mfcd62!!Mfcd62!!';

    console.log(`Conectando ao banco Chatwoot em ${host}:${port}/${name}`);

    const chatwootDb = knex({
      client: 'pg',
      connection: { host, port, database: name, user, password, ssl: false },
      pool: { min: 0, max: 2 }
    });

    await chatwootDb.raw('SELECT 1');
    return chatwootDb;
  } catch (error) {
    console.error('Erro ao criar conexão com banco de dados do Chatwoot:', error);
    throw new Error(`Erro ao criar conexão com banco de dados do Chatwoot: ${error.message}`);
  }
}

/**
 * Retorna detalhes dos usuários logados (online): id, name, email, open_conversations
 * @param {number} chatwootAccountId - ID da conta do Chatwoot
 * @param {number} systemAccountId - ID da conta no sistema
 * @returns {Promise<Array<{id:number,name:string,email:string,open_conversations:number}>>}
 */
async function getLoggedUsersDetails(chatwootAccountId, systemAccountId) {
  let chatwootDb;
  try {
    const onlineIds = await getOnlineAgents(chatwootAccountId, systemAccountId);
    if (!onlineIds || onlineIds.length === 0) return [];

    // Conectar no banco do Chatwoot usando o account_id
    chatwootDb = await createChatwootDbConnection(systemAccountId);

    // Buscar nome e email dos usuários online
    const users = await chatwootDb('users')
      .select('id', 'name', 'email')
      .whereIn('id', onlineIds);

    // Contar conversas em aberto por assignee_id
    const counts = await chatwootDb('conversations as c')
      .select('c.assignee_id')
      .count('c.id as open_count')
      .whereIn('c.assignee_id', onlineIds)
      .where('c.status', 0) // 0 = opened
      .groupBy('c.assignee_id');

    const countMap = {};
    counts.forEach(row => {
      countMap[row.assignee_id] = parseInt(row.open_count, 10);
    });

    return users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      open_conversations: countMap[u.id] || 0,
    }));
  } catch (err) {
    console.error('Erro em getLoggedUsersDetails:', err);
    throw err;
  } finally {
    if (chatwootDb) await chatwootDb.destroy();
  }
}

/**
 * Verifica se a atribuição automática está habilitada para a caixa de entrada
 * @param {knex} chatwootDb - Conexão com o banco de dados do Chatwoot
 * @param {number} inboxId - ID da caixa de entrada
 * @returns {Promise<object>} - Objeto com status da atribuição e configurações
 */
async function isAutoAssignmentDisabled(chatwootDb, inboxId) {
  console.log(`Verificando configuração de atribuição automática para inbox_id: ${inboxId}`);
  
  const inbox = await chatwootDb('inboxes')
    .select('enable_auto_assignment', 'auto_assignment_config')
    .where('id', inboxId)
    .first();
  
  // Se enable_auto_assignment for false, a atribuição automática está desabilitada
  console.log(`Configuração encontrada: enable_auto_assignment = ${inbox?.enable_auto_assignment}`);
  if (inbox?.auto_assignment_config) {
    console.log(`Configuração de auto_assignment_config encontrada:`, inbox.auto_assignment_config);
  }
  
  return {
    //disabled: inbox && inbox.enable_auto_assignment === false,
    disabled: true,
    auto_assignment_config: inbox?.auto_assignment_config || {"max_assignment_limit": "7"} // Valor padrão se não existir
  };
}

/**
 * Obtém a lista de agentes que podem atender a esta caixa de entrada
 * @param {knex} chatwootDb - Conexão com o banco de dados do Chatwoot
 * @param {number} inboxId - ID da caixa de entrada
 * @returns {Promise<number[]>} - Array de IDs dos agentes
 */
async function getAvailableAgentsForInbox(chatwootDb, inboxId) {
  console.log(`Obtendo agentes disponíveis para inbox_id: ${inboxId}`);
  
  // Buscar apenas usuários que são agentes (custom_role_id = 3) e estão associados a esta caixa de entrada
  const members = await chatwootDb('inbox_members as im')
    .join('account_users as au', 'im.user_id', 'au.user_id')
    .join('users as u', 'u.id', 'au.user_id')
    .select('im.user_id')
    .where('im.inbox_id', inboxId)
    .where('au.custom_role_id', 3); // 3 = vendedor
  
  const userIds = members.map(m => m.user_id);
  console.log(`Agentes encontrados para a caixa de entrada: ${userIds.length > 0 ? userIds.join(', ') : 'nenhum'} (total: ${userIds.length})`);
  
  return userIds;
}

/**
 * Obtém a lista de agentes online do Chatwoot
 * @param {number} chatwootAccountId - ID da conta do Chatwoot
 * @param {number} systemAccountId - ID da conta no sistema
 * @returns {Promise<number[]>} - Array de IDs dos agentes online
 */
async function getOnlineAgents(chatwootAccountId, systemAccountId) {
  console.log(`Obtendo agentes online para a conta Chatwoot: ${chatwootAccountId}`);
  
  try {
    // Buscar URL e token do Chatwoot
    const db = getDbConnection();
    const params = await db('account_parameter')
      .select('name', 'value')
      .where({ account_id: systemAccountId })
      .whereIn('name', ['chatwoot-url', 'chatwoot-token'])
      .then(rows => {
        const config = {};
        rows.forEach(r => { config[r.name] = r.value; });
        return config;
      });
    
    if (!params['chatwoot-url'] || !params['chatwoot-token']) {
      throw new Error(`Parâmetros 'chatwoot-url' ou 'chatwoot-token' não encontrados para account_id=${systemAccountId}`);
    }
    
    const baseUrl = params['chatwoot-url'].replace(/\/$/, '');
    const apiToken = params['chatwoot-token'];
    
    console.log(`Chamando API: ${baseUrl}/api/v1/accounts/${chatwootAccountId}/agents`);
    
    const response = await axios.get(
      `${baseUrl}/api/v1/accounts/${chatwootAccountId}/agents`,
      {
        headers: {
          'api_access_token': apiToken
        }
      }
    );
    
    // Log da estrutura da resposta para debug
    console.log(`Estrutura da resposta da API: ${JSON.stringify(response.data).substring(0, 200)}...`);
    
    // Verificar se os dados existem e ajustar a estrutura corretamente
    let onlineAgents = [];
    if (response.data) {
      // Se payload não existe, usa o data diretamente (pode ser um array)
      const agentsData = Array.isArray(response.data) ? response.data : 
                        (response.data.payload || response.data.agents || response.data.data || []);
      
      // Filtra os agentes que estão online
      onlineAgents = agentsData
        .filter(agent => agent && agent.availability_status === 'online')
        .map(agent => agent.id);
    }
    
    console.log(`Agentes online: ${onlineAgents.length > 0 ? onlineAgents.join(', ') : 'nenhum'} (total: ${onlineAgents.length})`);
    return onlineAgents;
  } catch (error) {
    console.error('Erro ao obter agentes online:', error);
    throw new Error(`Erro ao obter agentes online: ${error.message}`);
  }
}

/**
 * Obtém o agente que deve receber o próximo contato
 * @param {Array<number>} availableAgentIds - IDs dos agentes disponíveis
 * @param {number} inboxId - ID da caixa de entrada
 * @param {object} autoAssignmentConfig - Configuração de atribuição automática
 * @param {knex} chatwootDb - Conexão com o banco de dados Chatwoot
 * @returns {Promise<number|null>} - ID do agente selecionado ou null se não houver nenhum
 */
async function getNextAgent(availableAgentIds, inboxId, autoAssignmentConfig, chatwootDb) {
  if (!availableAgentIds || availableAgentIds.length === 0) {
    console.log('Nenhum agente disponível para atribuição');
    return null;
  }
  
  console.log(`Procurando próximo agente entre ${availableAgentIds.length} agentes disponíveis`);
  const maxAssignmentLimit = parseInt(autoAssignmentConfig?.max_assignment_limit || '7', 10);
  console.log(`Limite máximo de atendimentos por agente: ${maxAssignmentLimit}`);
  
  try {
    // 1. Encontrar agentes que já estão na tabela de atribuições para esta caixa de entrada
    const agentsWithAssignments = await clientsDb('empresta_assigned_contacts_register')
      .select('user_id')
      .distinct()
      .whereIn('user_id', availableAgentIds)
      .andWhere('inbox_id', inboxId);
    
    const agentsWithAssignmentsIds = agentsWithAssignments.map(a => a.user_id);
    console.log(`Agentes com atribuições registradas: ${agentsWithAssignmentsIds.length > 0 ? agentsWithAssignmentsIds.join(', ') : 'nenhum'}`);
    
    // 2. Filtrar para encontrar agentes sem atribuições (que não estão na tabela)
    const agentsWithoutAssignments = availableAgentIds.filter(id => !agentsWithAssignmentsIds.includes(id));
    console.log(`Agentes sem atribuições: ${agentsWithoutAssignments.length > 0 ? agentsWithoutAssignments.join(', ') : 'nenhum'}`);
    
    // 3. Se houver algum agente sem atribuições, usar o primeiro
    if (agentsWithoutAssignments.length > 0) {
      const selectedAgentId = agentsWithoutAssignments[0];
      console.log(`Selecionado agente sem atribuições anteriores: ${selectedAgentId}`);
      return selectedAgentId;
    }
    
    console.log('Todos os agentes já possuem atribuições, verificando limites de atendimentos em aberto');
    
    // 4. Verificar quais agentes estão abaixo do limite máximo de atendimentos em aberto
    const agentsWithOpenConversationCounts = await chatwootDb('conversations as c')
      .select('c.assignee_id')
      .count('c.id as open_count')
      .whereIn('c.assignee_id', availableAgentIds)
      .where('c.status', 0) // status 0 significa conversa em aberto no Chatwoot
      .groupBy('c.assignee_id');
    
    // Converter resultado para um mapa de contagens
    const agentOpenCountMap = {};
    agentsWithOpenConversationCounts.forEach(item => {
      agentOpenCountMap[item.assignee_id] = parseInt(item.open_count, 10);
    });
    
    console.log('Contagem de atendimentos em aberto por agente:', agentOpenCountMap);
    
    // Filtrar apenas agentes que estão abaixo do limite
    const agentsBelowLimit = availableAgentIds.filter(agentId => {
      const count = agentOpenCountMap[agentId] || 0;
      return count < maxAssignmentLimit;
    });
    
    console.log(`Agentes abaixo do limite de ${maxAssignmentLimit} atendimentos: ${agentsBelowLimit.length > 0 ? agentsBelowLimit.join(', ') : 'nenhum'}`);
    
    // Se houver agentes abaixo do limite, continuar com eles. Senão, usar todos os disponíveis
    const eligibleAgentIds = agentsBelowLimit;
    if (agentsBelowLimit.length === 0) {
      console.log('Nenhum agente disponível abaixo do limite de atendimentos');
      return null;
    }

    // 5. Selecionar o agente com a atribuição mais antiga entre os que estão abaixo do limite
    const agentWithOldestAssignment = await clientsDb('empresta_assigned_contacts_register as eacr')
      .select('eacr.user_id')
      .whereIn('eacr.user_id', eligibleAgentIds)
      .andWhere('eacr.inbox_id', inboxId)
      .groupBy('eacr.user_id')
      .orderByRaw('MAX(eacr.assign_time) ASC')
      .first();
    
    if (agentWithOldestAssignment) {
      console.log(`Agente com atribuição mais antiga: ${agentWithOldestAssignment.user_id}`);
      return agentWithOldestAssignment.user_id;
    }
    
    // 6. Se ainda não encontrou ninguém, pega o primeiro da lista
    console.log(`Nenhum agente encontrado no histórico, usando o primeiro disponível: ${eligibleAgentIds[0]}`);
    return eligibleAgentIds[0];
  } catch (error) {
    console.error('Erro ao selecionar próximo agente:', error);
    // Em caso de erro, seleciona o primeiro da lista
    return availableAgentIds[0];
  }
}

/**
 * Atribui a conversa ao agente no Chatwoot
 * @param {number} accountId - ID da conta do Chatwoot
 * @param {number} conversationId - ID da conversa
 * @param {number} assigneeId - ID do agente
 * @returns {Promise<object>} - Resposta da API do Chatwoot
 */
/**
 * Adiciona o gerente do agente como participante da conversa
 * @param {number} accountId - ID da conta
 * @param {number} conversationId - ID da conversa (display_id)
 * @param {number} assigneeId - ID do agente atribuído
 * @param {knex} chatwootDb - Conexão com o banco de dados do Chatwoot
 */
async function addManagerAsParticipant(chatwootAccountId, systemAccountId, conversationId, assigneeId, chatwootDb) {
  console.log(`Adicionando gerente como participante da conversa ${conversationId} para o agente ${assigneeId}`);
  try {
    // 1. Encontrar o time do agente
    const teamMember = await chatwootDb('team_members')
      .where({ user_id: assigneeId })
      .first();

    if (!teamMember) {
      console.log(`Agente ${assigneeId} não pertence a nenhum time. Pulando adição de gerente.`);
      return;
    }

    const { team_id } = teamMember;

    // 2. Encontrar o gerente do time (custom_role_id = 4)
    const manager = await chatwootDb('team_members as tm')
      .join('account_users as au', 'tm.user_id', 'au.user_id')
      .where('tm.team_id', team_id)
      .where('au.custom_role_id', 4)
      .select('tm.user_id')
      .first();

    if (!manager) {
      console.log(`Nenhum gerente (custom_role_id=4) encontrado para o time ${team_id}.`);
      return;
    }

    const managerId = manager.user_id;
    console.log(`Gerente encontrado: ${managerId} para o time ${team_id}`);

    // 3. Buscar configurações da API
    const db = getDbConnection();
    const params = await db('account_parameter')
      .select('name', 'value')
      .where({ account_id: systemAccountId })
      .whereIn('name', ['chatwoot-url', 'chatwoot-token'])
      .then(rows => {
        const config = {};
        rows.forEach(r => { config[r.name] = r.value; });
        return config;
      });
    
    const baseUrl = params['chatwoot-url'].replace(/\/$/, '');
    const apiToken = params['chatwoot-token'];

    // 4. Chamar a API para adicionar o agente e o gerente como participantes
    const participants = [assigneeId, managerId];
    await axios.patch(
      `${baseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${conversationId}/participants`,
      { user_ids: participants },
      {
        headers: {
          'api_access_token': apiToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Agente ${assigneeId} e gerente ${managerId} adicionados como participantes da conversa ${conversationId}.`);
  } catch (error) {
    // Não lançamos o erro para não interromper o fluxo principal de atribuição
    console.error('Erro ao adicionar gerente como participante:', error.message);
  }
}

/**
 * Altera o status da conversa no Chatwoot (ex: para 'open')
 * @param {number} accountId - ID da conta
 * @param {number} conversationId - ID da conversa
 * @param {string} status - Novo status ('open', 'snoozed', etc.)
 */
async function toggleConversationStatus(chatwootAccountId, systemAccountId, conversationId, status = 'open') {
  console.log(`Alterando status da conversa ${conversationId} para '${status}'`);
  try {
    // Buscar configurações da API
    const db = getDbConnection();
    const params = await db('account_parameter')
      .select('name', 'value')
      .where({ account_id: systemAccountId })
      .whereIn('name', ['chatwoot-url', 'chatwoot-token'])
      .then(rows => {
        const config = {};
        rows.forEach(r => { config[r.name] = r.value; });
        return config;
      });
    
    const baseUrl = params['chatwoot-url'].replace(/\/$/, '');
    const apiToken = params['chatwoot-token'];
    
    await axios.post(
      `${baseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${conversationId}/toggle_status`,
      { status }, // Payload para definir o status
      {
        headers: {
          'api_access_token': apiToken,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`Status da conversa ${conversationId} alterado para '${status}' com sucesso.`);
  } catch (error) {
    // Não lançar erro para não interromper o fluxo principal
    console.error(`Erro ao alterar status da conversa ${conversationId}:`, error.message);
  }
}

async function assignConversationToAgent(chatwootAccountId, systemAccountId, conversationId, assigneeId, chatwootDb) {
  console.log(`Atribuindo conversa ${conversationId} ao agente ${assigneeId}`);
  
  try {
    // Buscar configurações da API
    const db = getDbConnection();
    const params = await db('account_parameter')
      .select('name', 'value')
      .where({ account_id: systemAccountId })
      .whereIn('name', ['chatwoot-url', 'chatwoot-token'])
      .then(rows => {
        const config = {};
        rows.forEach(r => { config[r.name] = r.value; });
        return config;
      });
    
    const baseUrl = params['chatwoot-url'].replace(/\/$/, '');
    const apiToken = params['chatwoot-token'];
    
    const response = await axios.post(
      `${baseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${conversationId}/assignments`,
      { assignee_id: assigneeId },
      {
        headers: {
          'api_access_token': apiToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Atribuição realizada com sucesso:', response.data);

    // Altera o status da conversa para 'aberta' para que apareça corretamente para o agente
    await toggleConversationStatus(chatwootAccountId, systemAccountId, conversationId, 'open');

    // Adiciona o gerente como participante da conversa
    await addManagerAsParticipant(chatwootAccountId, systemAccountId, conversationId, assigneeId, chatwootDb);

    return response.data;
  } catch (error) {
    console.error('Erro ao atribuir conversa:', error);
    throw new Error(`Erro ao atribuir conversa: ${error.message}`);
  }
}

/**
 * Atribui múltiplas conversas não atribuídas ao mesmo agente até atingir o limite
 * @param {number} accountId - ID da conta do Chatwoot
 * @param {number} inboxId - ID da caixa de entrada
 * @param {number} agentId - ID do agente selecionado
 * @param {object} autoAssignmentConfig - Configuração de limite de atendimentos
 * @param {knex} chatwootDb - Conexão com o banco de dados do Chatwoot
 * @returns {Promise<object>} - Resultado da atribuição múltipla
 */
async function assignMultipleConversations(chatwootAccountId, systemAccountId, inboxId, agentId, autoAssignmentConfig, chatwootDb) {
  console.log(`Verificando atribuição de múltiplas conversas para o agente ${agentId}`);
  
  try {
    // 1. Verificar quantas conversas o agente já possui atualmente
    const currentAssignments = await chatwootDb('conversations')
      .where({
        assignee_id: agentId,
        status: 0 // conversas abertas
      })
      .count('id as count')
      .first();
    
    const currentCount = parseInt(currentAssignments?.count || '0', 10);
    const maxAssignmentLimit = parseInt(autoAssignmentConfig?.max_assignment_limit || '7', 10);
    const remainingSlots = Math.max(0, maxAssignmentLimit - currentCount);
    
    console.log(`Agente ${agentId} tem ${currentCount}/${maxAssignmentLimit} conversas em aberto (restam ${remainingSlots} vagas)`);
    
    if (remainingSlots <= 0) {
      console.log(`Agente ${agentId} já atingiu ou excedeu o limite de ${maxAssignmentLimit} atendimentos`);  
      return { 
        status: 'skipped',
        reason: 'agent_at_capacity',
        assignedCount: 0
      };
    }
    
    // 2. Buscar conversas não atribuídas OU atribuídas ao usuário de fallback (1) para redistribuir ao agente (priorizando mais antigas)
    const unassignedConversations = await chatwootDb('conversations')
      .select('id', 'display_id', 'contact_id')
      .where({
        inbox_id: inboxId,
        status: 0 // conversa aberta
      })
      .andWhere((qb) => {
        qb.whereNull('assignee_id').orWhere('assignee_id', DEFAULT_ASSIGNEE_ID);
      })
      .orderBy('created_at', 'asc')
      .limit(remainingSlots);
    
    console.log(`Encontradas ${unassignedConversations.length} conversas não atribuídas (ordenadas por mais antigas primeiro)`); 
    
    if (unassignedConversations.length === 0) {
      return { 
        status: 'success',
        reason: 'no_unassigned_conversations',
        assignedCount: 0
      };
    }
    
    // 3. Atribuir cada conversa ao agente
    const results = [];
    for (const conversation of unassignedConversations) {
      try {
        // Atribuir conversa
        await assignConversationToAgent(chatwootAccountId, systemAccountId, conversation.display_id, agentId, chatwootDb);
        
        // Registrar atribuição no histórico
        await registerAssignment(inboxId, agentId, conversation.contact_id);
        
        results.push({
          conversationId: conversation.id,
          contactId: conversation.contact_id,
          status: 'success'
        });
      } catch (error) {
        console.error(`Erro ao atribuir conversa ${conversation.id}:`, error.message);
        results.push({
          conversationId: conversation.id,
          contactId: conversation.contact_id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`Atribuídas com sucesso ${successCount} conversas adicionais ao agente ${agentId}`);
    
    return {
      status: 'success',
      assignedCount: successCount,
      totalAttempted: unassignedConversations.length,
      details: results
    };
    
  } catch (error) {
    console.error('Erro ao atribuir múltiplas conversas:', error);
    return {
      status: 'error',
      reason: `erro_ao_atribuir_multiplas: ${error.message}`,
      assignedCount: 0
    };
  }
}

/**
 * Registra a atribuição do contato na tabela de histórico
 * @param {number} inboxId - ID da caixa de entrada
 * @param {number} userId - ID do usuário
 * @param {number} contactId - ID do contato
 * @returns {Promise<object>} - Registro criado
 */
async function registerAssignment(inboxId, userId, contactId) {
  console.log(`Registrando atribuição: inbox=${inboxId}, user=${userId}, contact=${contactId}`);
  
  const [id] = await clientsDb('empresta_assigned_contacts_register')
    .insert({
      inbox_id: inboxId,
      user_id: userId,
      contact_id: contactId
    })
    .returning('id');
  
  return { id };
}

/**
 * Função principal para atribuir contato a um agente
 * @param {number} accountId - ID da conta do Chatwoot
 * @param {number} contactId - ID do contato
 * @param {number} inboxId - ID da caixa de entrada
 * @param {number} conversationId - ID da conversa
 * @returns {Promise<object>} - Resultado da atribuição
 */
/**
 * Busca os detalhes de uma conversa específica no banco de dados do Chatwoot.
 * @param {object} chatwootDb - Conexão Knex com o banco de dados.
 * @param {number} conversationId - ID da conversa.
 * @returns {Promise<object>} - Dados da conversa.
 */
async function getConversationDetails(chatwootDb, conversationId) {
  try {
    const conversation = await chatwootDb('conversations')
      .where({ display_id: conversationId })
      .first();
    return conversation;
  } catch (error) {
    console.error(`Erro ao buscar detalhes da conversa ${conversationId} no banco de dados:`, error.message);
    throw new Error(`Não foi possível obter detalhes da conversa ${conversationId} do banco de dados.`);
  }
}

const assignContactToAgent = async (chatwootAccountId, systemAccountId, contactId, inboxId, conversationId) => {
  console.log(`Iniciando processo de atribuição para conta Chatwoot ${chatwootAccountId} (system account ${systemAccountId}), conversa ${conversationId}`);

  let chatwootDb = null;
  try {
    // Criar conexão com o banco de dados do Chatwoot
    chatwootDb = await createChatwootDbConnection(systemAccountId);

    // 1. Buscar detalhes da conversa para verificar se já há um agente
    const conversationDetails = await getConversationDetails(chatwootDb, conversationId);
    if (!conversationDetails) {
      console.log(`Conversa com ID ${conversationId} não encontrada.`);
      return { status: 'error', reason: 'conversation_not_found' };
    }

    const assigneeId = conversationDetails.assignee_id;
    if (assigneeId) {
      console.log(`Conversa ${conversationId} já possui atendente (ID: ${assigneeId}). Pulando.`);
      return {
        status: 'skipped',
        reason: 'already_assigned',
        assigneeId: assigneeId
      };
    }

    // 2. Verificar se a atribuição automática está desabilitada para esta caixa de entrada
    const autoAssignmentConfig = await isAutoAssignmentDisabled(chatwootDb, inboxId);
    if (!autoAssignmentConfig.disabled) {
      console.log('Atribuição automática já está habilitada no Chatwoot. Pulando.');
      return {
        status: 'skipped',
        reason: 'auto_assignment_enabled_in_chatwoot'
      };
    }

    // 3. Obter agentes disponíveis e online
    const inboxAgentIds = await getAvailableAgentsForInbox(chatwootDb, inboxId);
    const onlineAgentIds = await getOnlineAgents(chatwootAccountId, systemAccountId);
    const availableAgentIds = inboxAgentIds.filter(id => onlineAgentIds.includes(id));

    if (availableAgentIds.length === 0) {
      console.log('Nenhum agente online disponível para esta caixa de entrada. Atribuindo para o usuário padrão (1).');
      await assignConversationToAgent(chatwootAccountId, systemAccountId, conversationId, DEFAULT_ASSIGNEE_ID, chatwootDb);
      await registerAssignment(inboxId, DEFAULT_ASSIGNEE_ID, contactId);
      return { status: 'assigned_to_default', assigneeId: DEFAULT_ASSIGNEE_ID, reason: 'no_available_agents' };
    }

    // 4. Determinar o próximo agente
    const selectedAgentId = await getNextAgent(availableAgentIds, inboxId, autoAssignmentConfig.auto_assignment_config, chatwootDb);

    if (!selectedAgentId) {
      console.log('Todos os agentes disponíveis atingiram o limite. Atribuindo para o usuário padrão (1).');
      await assignConversationToAgent(chatwootAccountId, systemAccountId, conversationId, DEFAULT_ASSIGNEE_ID, chatwootDb);
      await registerAssignment(inboxId, DEFAULT_ASSIGNEE_ID, contactId);
      return { status: 'assigned_to_default', assigneeId: DEFAULT_ASSIGNEE_ID, reason: 'agents_at_capacity' };
    }

    // 5. Atribuir a conversa principal (que também adicionará o gerente como participante)
    await assignConversationToAgent(chatwootAccountId, systemAccountId, conversationId, selectedAgentId, chatwootDb);
    await registerAssignment(inboxId, selectedAgentId, contactId);
    console.log(`Conversa ${conversationId} atribuída com sucesso ao agente ${selectedAgentId}`);

    // 6. Atribuir conversas adicionais
    const multipleAssignmentResult = await assignMultipleConversations(
      chatwootAccountId,
      systemAccountId,
      inboxId,
      selectedAgentId,
      autoAssignmentConfig.auto_assignment_config,
      chatwootDb
    );

    return {
      status: 'success',
      assignedAgentId: selectedAgentId,
      assignedConversationId: conversationId,
      additionalAssignments: multipleAssignmentResult
    };

  } catch (error) {
    console.error('Erro fatal durante o processo de atribuição:', error);
    throw error; // Re-lança o erro para ser tratado pelo handler
  } finally {
    if (chatwootDb) {
      await chatwootDb.destroy();
      console.log('Conexão com o banco de dados do Chatwoot fechada.');
    }
  }
};

module.exports = {
  assignContactToAgent,
  assignMultipleConversations,
  getOnlineAgents,
  getLoggedUsersDetails
};
