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

// Não utilizar mais usuário admin (id=1) como fallback de atribuição

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

async function shouldAssignOnlyActiveUsers(systemAccountId) {
  try {
    const db = getDbConnection();
    const row = await db('account_parameter')
      .select('value')
      .where({ account_id: systemAccountId, name: 'assign_only_active_users' })
      .first();

    const raw = (row && row.value ? String(row.value) : '').trim().toUpperCase();
    if (!raw) return true;
    if (raw === 'FALSE') return false;
    return true;
  } catch (error) {
    console.error('Erro ao ler parâmetro assign_only_active_users:', error);
    return true;
  }
}

async function getChatwootApiConfig(systemAccountId) {
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

  return { baseUrl, apiToken };
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
    .where(function (qb) {
      qb.where('au.custom_role_id', 3).orWhereNull('au.custom_role_id');
    }); // 3 = vendedor, ou null (sem papel definido)
  
  const userIds = members.map(m => m.user_id);
  console.log(`Agentes encontrados para a caixa de entrada: ${userIds.length > 0 ? userIds.join(', ') : 'nenhum'} (total: ${userIds.length})`);
  
  return userIds;
}

/**
 * Obtém a lista de agentes disponíveis considerando inbox, atividade, time e regra de ignorar admin.
 * @param {knex} chatwootDb - Conexão com o banco de dados do Chatwoot
 * @param {number} chatwootAccountId - ID da conta do Chatwoot
 * @param {number} systemAccountId - ID da conta no sistema
 * @param {number} inboxId - ID da caixa de entrada
 * @param {number|null} chatwootTeamId - ID do time do Chatwoot (quando houver)
 * @returns {Promise<number[]>} - IDs dos agentes disponíveis
 */
async function getAvailableAgentIds(chatwootDb, chatwootAccountId, systemAccountId, inboxId, chatwootTeamId) {
  const activeOnly = await shouldAssignOnlyActiveUsers(systemAccountId);
  let availableAgentIds;

  if (activeOnly) {
    const inboxAgentIds = await getAvailableAgentsForInbox(chatwootDb, inboxId);
    const onlineAgentIds = await getOnlineAgents(chatwootAccountId, systemAccountId);
    let candidateIds = inboxAgentIds.filter((id) => onlineAgentIds.includes(id));

    // Se houver time definido no step, filtra apenas agentes desse time
    if (chatwootTeamId) {
      const teamMembers = await chatwootDb('team_members')
        .select('user_id')
        .where('team_id', chatwootTeamId);
      const teamUserIds = teamMembers.map((m) => Number(m.user_id));
      candidateIds = candidateIds.filter((id) => teamUserIds.includes(Number(id)));
      console.log(`Filtrando agentes pelo time ${chatwootTeamId}. Restaram ${candidateIds.length} agentes elegíveis.`);
    }

    // Garante que o usuário admin (id=1) nunca seja elegível
    availableAgentIds = candidateIds.filter((id) => id !== 1);
  } else {
    // Quando assign_only_active_users = FALSE, considerar todos os usuários da tabela users
    let allUsers = await chatwootDb('users').select('id');
    allUsers = allUsers.filter((u) => u.id !== 1);

    if (chatwootTeamId) {
      const teamMembers = await chatwootDb('team_members')
        .select('user_id')
        .where('team_id', chatwootTeamId);
      const teamUserIds = teamMembers.map((m) => m.user_id);
      availableAgentIds = allUsers.map((u) => u.id).filter((id) => teamUserIds.includes(id));
      console.log(`assign_only_active_users=FALSE com time ${chatwootTeamId} -> usando apenas usuários do time (${availableAgentIds.length})`);
    } else {
      availableAgentIds = allUsers.map((u) => u.id);
      console.log(`assign_only_active_users=FALSE -> usando todos os usuários da tabela users (${availableAgentIds.length})`);
    }
  }

  if (!availableAgentIds || availableAgentIds.length === 0) {
    console.log('Nenhum agente disponível para esta caixa de entrada (considerando filtros de time/atividade). Nenhuma atribuição será realizada.');
    return [];
  }

  return availableAgentIds;
}

// ...

async function getOnlineAgents(chatwootAccountId, systemAccountId) {
  console.log(`Obtendo agentes online para a conta Chatwoot: ${chatwootAccountId}`);
  try {
    // Buscar URL e token do Chatwoot
    const { baseUrl, apiToken } = await getChatwootApiConfig(systemAccountId);

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
    // Garante que o usuário admin (id=1) nunca seja considerado como agente elegível
    return onlineAgents.filter((id) => id !== 1);
  } catch (error) {
    console.error('Erro ao obter agentes online:', error);
    throw new Error(`Erro ao obter agentes online: ${error.message}`);
  }
}

// ...

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
    const { baseUrl, apiToken } = await getChatwootApiConfig(systemAccountId);

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

// ...

async function toggleConversationStatus(chatwootAccountId, systemAccountId, conversationId, status = 'open') {
  console.log(`Alterando status da conversa ${conversationId} para '${status}'`);
  try {
    // Buscar configurações da API
    const { baseUrl, apiToken } = await getChatwootApiConfig(systemAccountId);

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

/**
 * Obtém o agente que deve receber o próximo contato.
 * Implementação baseada em histórico de atribuições (empresta_assigned_contacts_register)
 * e no limite máximo de atendimentos em aberto por agente (autoAssignmentConfig.max_assignment_limit).
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

    const agentsWithAssignmentsIds = agentsWithAssignments.map((a) => a.user_id);
    console.log(
      `Agentes com atribuições registradas: ${
        agentsWithAssignmentsIds.length > 0 ? agentsWithAssignmentsIds.join(', ') : 'nenhum'
      }`
    );

    // 2. Filtrar para encontrar agentes sem atribuições (que não estão na tabela)
    const agentsWithoutAssignments = availableAgentIds.filter(
      (id) => !agentsWithAssignmentsIds.includes(id)
    );
    console.log(
      `Agentes sem atribuições: ${
        agentsWithoutAssignments.length > 0 ? agentsWithoutAssignments.join(', ') : 'nenhum'
      }`
    );

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
      .where('c.status', 0) // status 0 = conversa aberta no Chatwoot
      .groupBy('c.assignee_id');

    // Converter resultado para um mapa de contagens
    const agentOpenCountMap = {};
    agentsWithOpenConversationCounts.forEach((item) => {
      agentOpenCountMap[item.assignee_id] = parseInt(item.open_count, 10);
    });

    console.log('Contagem de atendimentos em aberto por agente:', agentOpenCountMap);

    // Filtrar apenas agentes que estão abaixo do limite
    const agentsBelowLimit = availableAgentIds.filter((agentId) => {
      const count = agentOpenCountMap[agentId] || 0;
      return count < maxAssignmentLimit;
    });

    console.log(
      `Agentes abaixo do limite de ${maxAssignmentLimit} atendimentos: ${
        agentsBelowLimit.length > 0 ? agentsBelowLimit.join(', ') : 'nenhum'
      }`
    );

    if (agentsBelowLimit.length === 0) {
      console.log('Nenhum agente disponível abaixo do limite de atendimentos');
      return null;
    }

    const eligibleAgentIds = agentsBelowLimit;

    // 5. Selecionar o agente com a atribuição mais antiga entre os que estão abaixo do limite
    const agentWithOldestAssignment = await clientsDb(
      'empresta_assigned_contacts_register as eacr'
    )
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

    // 6. Se ainda não encontrou ninguém, pega o primeiro da lista elegível
    console.log(
      `Nenhum agente encontrado no histórico, usando o primeiro disponível: ${eligibleAgentIds[0]}`
    );
    return eligibleAgentIds[0];
  } catch (error) {
    console.error('Erro ao selecionar próximo agente:', error);
    // Em caso de erro, seleciona o primeiro da lista como fallback
    return availableAgentIds[0];
  }
}

async function assignConversationToAgent(chatwootAccountId, systemAccountId, conversationId, assigneeId, chatwootDb) {
  console.log(`Atribuindo conversa ${conversationId} ao agente ${assigneeId}`);
  try {
    // Buscar configurações da API
    const { baseUrl, apiToken } = await getChatwootApiConfig(systemAccountId);

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
 * Função principal para atribuir contato a um agente
 * @param {number} chatwootAccountId - ID da conta do Chatwoot
 * @param {number} systemAccountId - ID da conta no sistema
 * @param {number} contactId - ID do contato
 * @param {number} inboxId - ID da caixa de entrada
 * @param {number} conversationId - ID da conversa
 * @param {number|null} chatwootTeamId - ID do time do Chatwoot (quando houver)
 * @returns {Promise<object>} - Resultado da atribuição
 */
const assignContactToAgent = async (chatwootAccountId, systemAccountId, contactId, inboxId, conversationId, chatwootTeamId) => {
  console.log(`Iniciando processo de atribuição para conta Chatwoot ${chatwootAccountId} (system account ${systemAccountId}), conversa ${conversationId}`);

  let chatwootDb = null;
  try {
    // Criar conexão com o banco de dados do Chatwoot
    chatwootDb = await createChatwootDbConnection(systemAccountId);

    // 1. Buscar detalhes da conversa com lock pessimista (SELECT FOR UPDATE NOWAIT) para evitar race conditions
    let conversationDetails;
    try {
      conversationDetails = await chatwootDb.transaction(async (trx) => {
        const conversation = await trx('conversations')
          .where({ display_id: conversationId })
          .forUpdate()
          .noWait() // Falha imediatamente se já houver lock ativo - evita espera desnecessária
          .first();
        
        if (!conversation) {
          throw new Error('conversation_not_found');
        }
        
        // Verificar se já possui atendente DENTRO da transação
        if (conversation.assignee_id) {
          console.log(`Conversa ${conversationId} já possui atendente (ID: ${conversation.assignee_id}). Pulando.`);
          throw new Error(`already_assigned:${conversation.assignee_id}`);
        }
        
        return conversation;
      });
    } catch (lockError) {
      // Tratar erro de lock NOWAIT imediatamente
      if (lockError.code === '55P03' || lockError.message.includes('could not obtain lock')) {
        console.log(`⚠️ NOWAIT LOCK: Conversa ${conversationId} está bloqueada por outra requisição simultânea. Não foi possível atribuir (race condition detectada e prevenida).`);
        return {
          status: 'skipped',
          reason: 'conversation_locked_by_another_process'
        };
      }
      
      // Tratar erro de conversa já atribuída (não é um erro fatal, é esperado)
      if (lockError.message.startsWith('already_assigned:')) {
        const assigneeId = parseInt(lockError.message.split(':')[1], 10);
        console.log(`ℹ️ Conversa ${conversationId} já possui atendente (ID: ${assigneeId}). Atribuição não necessária.`);
        return {
          status: 'skipped',
          reason: 'already_assigned',
          assigneeId: assigneeId
        };
      }
      
      // Tratar erro de conversa não encontrada
      if (lockError.message === 'conversation_not_found') {
        console.log(`❌ Conversa ${conversationId} não encontrada no banco de dados.`);
        return { 
          status: 'error', 
          reason: 'conversation_not_found' 
        };
      }
      
      // Re-lançar outros erros da transação
      throw lockError;
    }

    // Se chegou aqui, a conversa foi lockada e não tem assignee
    console.log(`Conversa ${conversationId} disponível para atribuição (sem assignee).`);

    // 2. Verificar se a atribuição automática está desabilitada para esta caixa de entrada
    const autoAssignmentConfig = await isAutoAssignmentDisabled(chatwootDb, inboxId);
    if (!autoAssignmentConfig.disabled) {
      console.log('Atribuição automática já está habilitada no Chatwoot. Pulando.');
      return {
        status: 'skipped',
        reason: 'auto_assignment_enabled_in_chatwoot'
      };
    }

    // 3. Obter agentes disponíveis considerando configuração assign_only_active_users e time (quando houver)
    const availableAgentIds = await getAvailableAgentIds(
      chatwootDb,
      chatwootAccountId,
      systemAccountId,
      inboxId,
      chatwootTeamId
    );

    if (!availableAgentIds || availableAgentIds.length === 0) {
      return { status: 'skipped', reason: 'no_available_agents' };
    }

    // 4. Determinar o próximo agente
    const selectedAgentId = await getNextAgent(availableAgentIds, inboxId, autoAssignmentConfig.auto_assignment_config, chatwootDb);

    if (!selectedAgentId) {
      console.log('Todos os agentes disponíveis atingiram o limite de atendimentos. Nenhuma atribuição será realizada.');
      return { status: 'skipped', reason: 'agents_at_capacity' };
    }

    // 5. Atribuir a conversa principal (que também adicionará o gerente como participante)
    await assignConversationToAgent(chatwootAccountId, systemAccountId, conversationId, selectedAgentId, chatwootDb);
    console.log(`Conversa ${conversationId} atribuída com sucesso ao agente ${selectedAgentId}`);

    return {
      status: 'success',
      assignedAgentId: selectedAgentId,
      assignedConversationId: conversationId,
    };

  } catch (error) {
    console.error('❌ Erro fatal durante o processo de atribuição:', error);
    throw error; // Re-lança erros inesperados para serem tratados pelo handler
  } finally {
    if (chatwootDb) {
      await chatwootDb.destroy();
      console.log('Conexão com o banco de dados do Chatwoot fechada.');
    }
  }
};

module.exports = {
  assignContactToAgent,
  getOnlineAgents,
  getLoggedUsersDetails
};
