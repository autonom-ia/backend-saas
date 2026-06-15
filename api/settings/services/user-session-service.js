/**
 * Serviço para gerenciar as sessões de usuários
 */
const { getDbConnection } = require('../utils/database');
const { getCache, invalidateCache } = require('../utils/cache');
const { updateCampaignInboxDispatchFromContact } = require('./campaign-inbox-service');

const resolveInboxIdFromSessionData = (sessionData) => {
  return sessionData?.inbox_id || sessionData?.inboxId || null;
};

const resolveStatusFromSessionData = (sessionData) => {
  if (typeof sessionData?.status === 'string' && sessionData.status.trim().length > 0) {
    return sessionData.status;
  }

  return 'delivered';
};

const getPhoneDigits = (phone) => String(phone || '').replace(/\D/g, '');

const findExistingSessionByPhone = async (db, sessionData) => {
  console.log(`Verificando se já existe uma sessão para o telefone ${sessionData.phone} na conta ${sessionData.account_id}...`);

  const exactSession = await db('user_session')
    .where({
      phone: sessionData.phone,
      account_id: sessionData.account_id
    })
    .first();

  if (exactSession) {
    return exactSession;
  }

  const digits = getPhoneDigits(sessionData.phone);
  if (digits.length < 12) {
    console.log('Telefone não possui dígitos suficientes para match flexível 4+8; pulando segunda busca', {
      phone: sessionData.phone,
      digits,
    });
    return null;
  }

  const prefix = digits.slice(0, 4);
  const suffix = digits.slice(-8);
  const cleanedColumn = "regexp_replace(phone, '[^0-9]', '', 'g')";

  console.log('Nenhuma sessão exata encontrada. Tentando match flexível 4+8 dígitos', {
    accountId: sessionData.account_id,
    phone: sessionData.phone,
    prefix,
    suffix,
  });

  return db('user_session')
    .where('account_id', sessionData.account_id)
    .andWhereRaw(
      `substring(${cleanedColumn} from 1 for 4) = ? and right(${cleanedColumn}, 8) = ?`,
      [prefix, suffix],
    )
    .orderBy('created_at', 'asc')
    .first();
};

const assignIfPresent = (target, source, sourceKey, targetKey = sourceKey) => {
  if (source[sourceKey] !== undefined && source[sourceKey] !== null && source[sourceKey] !== '') {
    target[targetKey] = source[sourceKey];
  }
};

const assignIntegerIfPresent = (target, source, sourceKey, targetKey = sourceKey) => {
  if (source[sourceKey] === undefined || source[sourceKey] === null || source[sourceKey] === '') {
    return;
  }

  const value = Number(source[sourceKey]);
  if (Number.isInteger(value)) {
    target[targetKey] = value;
  }
};

const buildExistingSessionUpdate = (existingSession, sessionData, contactId) => {
  const updatePayload = {};

  assignIfPresent(updatePayload, sessionData, 'name');
  assignIfPresent(updatePayload, sessionData, 'phone');
  assignIfPresent(updatePayload, sessionData, 'product_id');
  assignIfPresent(updatePayload, sessionData, 'message_time');
  assignIfPresent(updatePayload, sessionData, 'conversation_funnel_step_id');
  assignIntegerIfPresent(updatePayload, sessionData, 'inbox_id');
  assignIntegerIfPresent(updatePayload, sessionData, 'inboxId', 'inbox_id');
  assignIntegerIfPresent(updatePayload, sessionData, 'conversation_id');
  assignIntegerIfPresent(updatePayload, sessionData, 'conversationId', 'conversation_id');

  updatePayload.contact_id = contactId || existingSession.contact_id || null;
  updatePayload.last_access = new Date();
  updatePayload.updated_at = new Date();

  return updatePayload;
};

const updateCampaignInboxForSession = async (db, sessionData, fallbackContactId = null) => {
  const contactId = sessionData?.contact_id || fallbackContactId;

  if (!contactId) {
    return;
  }

  try {
    await updateCampaignInboxDispatchFromContact({
      db,
      contactId,
      inboxId: resolveInboxIdFromSessionData(sessionData),
      status: resolveStatusFromSessionData(sessionData),
    });
  } catch (campaignInboxError) {
    console.error('[createUserSession] Erro ao atualizar campaign_inbox', {
      contactId,
      error: campaignInboxError,
    });
  }
};

const updateContactStatusForSession = async (db, sessionData, fallbackContactId = null) => {
  const contactId = sessionData?.contact_id || fallbackContactId;

  if (!contactId) {
    return;
  }

  try {
    await db('contact')
      .where({ id: contactId })
      .update({
        external_status: resolveStatusFromSessionData(sessionData),
        updated_at: db.fn.now(),
      });
  } catch (updateError) {
    console.error('[createUserSession] Erro ao atualizar status do contato', {
      contactId,
      error: updateError,
    });
  }
};

const ensureContactForSession = async (db, params) => {
  if (params.contact_id) {
    return params.contact_id;
  }

  const baseName = params.name || '';
  const trimmedName = baseName.trim();
  const hasName = trimmedName.length > 0;
  const fallbackName = params.phone || 'Contato';
  const name = hasName ? trimmedName : fallbackName;

  const [createdContact] = await db('contact')
    .insert({
      name,
      phone: params.phone || null,
      account_id: params.account_id,
      contact_data: {},
    })
    .returning('*');

  if (!createdContact || !createdContact.id) {
    throw new Error('Falha ao criar contato para a sessão de usuário');
  }

  return createdContact.id;
};

/**
 * Cria uma nova sessão de usuário no sistema ou retorna uma existente com o mesmo telefone e conta
 * @param {Object} sessionData - Dados da sessão do usuário
 * @param {string} sessionData.name - Nome do usuário
 * @param {string} sessionData.phone - Número de telefone do usuário
 * @param {string} sessionData.account_id - ID da conta associada (UUID)
 * @param {string} sessionData.product_id - ID do produto associado (UUID)
 * @param {number} [sessionData.message_time] - Tempo da mensagem em segundos
 * @returns {Promise<Object>} - A sessão criada ou existente com ID
 */
const createUserSession = async (sessionData) => {
  // Validar dados obrigatórios
  if (!sessionData.name) {
    throw new Error('Nome é obrigatório para criar sessão');
  }
  if (!sessionData.phone) {
    throw new Error('Telefone é obrigatório para criar sessão');
  }
  if (!sessionData.account_id) {
    throw new Error('ID da conta é obrigatório para criar sessão');
  }
  if (!sessionData.product_id) {
    throw new Error('ID do produto é obrigatório para criar sessão');
  }

  try {
    // Obter conexão com o banco
    const db = getDbConnection();
    
    const existingSession = await findExistingSessionByPhone(db, sessionData);
    
    // Se já existe uma sessão, atualiza os dados recebidos e evita criar duplicidade por variação do nono dígito.
    if (existingSession) {
      console.log(`Sessão existente encontrada com ID: ${existingSession.id}`);
      const contactId = await ensureContactForSession(db, {
        contact_id: sessionData.contact_id || existingSession.contact_id,
        name: sessionData.name || existingSession.name,
        phone: sessionData.phone || existingSession.phone,
        account_id: sessionData.account_id || existingSession.account_id,
      });

      const updatePayload = buildExistingSessionUpdate(existingSession, sessionData, contactId);

      const [updatedSession] = await db('user_session')
        .where({ id: existingSession.id })
        .update(updatePayload)
        .returning('*');

      await updateContactStatusForSession(db, sessionData, contactId);
      await updateCampaignInboxForSession(db, sessionData, contactId);

      const sessionResult = updatedSession || { ...existingSession, ...updatePayload };

      const oldCacheKey = `product-account:${existingSession.phone}`;
      const newCacheKey = `product-account:${sessionData.phone}`;
      await invalidateCache(oldCacheKey);
      if (newCacheKey !== oldCacheKey) {
        await invalidateCache(newCacheKey);
      }

      return sessionResult;
    }
    
    console.log('Nenhuma sessão existente encontrada. Criando nova sessão...');
    
    // Preparar dados para inserção
    const contactIdForNewSession = await ensureContactForSession(db, {
      contact_id: sessionData.contact_id,
      name: sessionData.name,
      phone: sessionData.phone,
      account_id: sessionData.account_id,
    });

    await updateContactStatusForSession(db, sessionData, contactIdForNewSession);

    const newSession = {
      name: sessionData.name,
      phone: sessionData.phone,
      account_id: sessionData.account_id,
      product_id: sessionData.product_id,
      contact_id: contactIdForNewSession,
      created_at: new Date(),
      updated_at: new Date(),
    };

    assignIfPresent(newSession, sessionData, 'message_time');
    assignIfPresent(newSession, sessionData, 'conversation_funnel_step_id');
    assignIntegerIfPresent(newSession, sessionData, 'inbox_id');
    assignIntegerIfPresent(newSession, sessionData, 'inboxId', 'inbox_id');
    assignIntegerIfPresent(newSession, sessionData, 'conversation_id');
    assignIntegerIfPresent(newSession, sessionData, 'conversationId', 'conversation_id');
    
    // Buscar o funil associado à conta
    console.log(`Buscando funil associado à conta ${sessionData.account_id}...`);
    const accountWithFunnel = await db('account')
      .where('id', sessionData.account_id)
      .select('conversation_funnel_id')
      .first();
    
    let firstFunnelStep = null;
    
    // Se a conta tem um funil associado, buscar a etapa inicial
    if (accountWithFunnel && accountWithFunnel.conversation_funnel_id) {
      console.log(`Funil encontrado: ${accountWithFunnel.conversation_funnel_id}`);
      
      // Buscar a etapa marcada como first_step = true para este funil
      firstFunnelStep = await db('conversation_funnel_step')
        .where({
          'conversation_funnel_id': accountWithFunnel.conversation_funnel_id,
          'first_step': true
        })
        .select('id')
        .first();
    } else {
      console.log('Conta não tem funil associado.');
    }
    
    // Se encontrou uma etapa inicial do funil, adiciona o ID aos dados da sessão
    if (firstFunnelStep && firstFunnelStep.id) {
      console.log(`Etapa inicial do funil encontrada: ${firstFunnelStep.id}`);
      newSession.conversation_funnel_step_id = firstFunnelStep.id;
    } else {
      console.log('Nenhuma etapa inicial do funil encontrada para esta conta.');
    }
    
    // Inserir nova sessão e garantir que o ID seja retornado
    const [createdSession] = await db('user_session')
      .insert(newSession)
      .returning('*');

    if (!createdSession || !createdSession.id) {
      throw new Error('Falha ao obter o ID da sessão criada');
    }

    await updateCampaignInboxForSession(db, sessionData, contactIdForNewSession);

    console.log('Sessão criada com sucesso. ID:', createdSession.id);
    
    // Invalidar cache relacionado
    const cacheKey = `product-account:${sessionData.phone}`;
    await invalidateCache(cacheKey);

    // Invalidar também o cache do formato com dois parâmetros se existir
    // Como não sabemos qual seria o accountPhone, usamos padrão de deleção
    // Nota: o Redis não suporta diretamente invalidar por padrão via 'del', precisaríamos usar SCAN + DEL
    // Para implementar isso corretamente, precisaríamos adicionar essa funcionalidade no módulo de cache
    // Por enquanto, vamos focar apenas na invalidação da chave principal
    // const patternKey = `product-account:${sessionData.phone}:*`;
    // await invalidateCache(patternKey, true);
    
    return createdSession;
  } catch (error) {
    console.error('Erro ao criar sessão de usuário:', error);
    throw new Error(`Erro ao criar sessão: ${error.message}`);
  }
};

/**
 * Busca uma sessão de usuário pelo seu ID
 * @param {string} id - ID da sessão de usuário a ser buscada
 * @returns {Promise<Object|null>} - A sessão encontrada ou null se não existir
 */
const getUserSessionById = async (id) => {
  if (!id) {
    throw new Error('ID é obrigatório para buscar sessão');
  }

  try {
    // Obter conexão com o banco
    const db = getDbConnection();
    
    // Buscar sessão pelo ID
    const session = await db('user_session').where({ id }).first();
    
    return session || null;
  } catch (error) {
    console.error('Erro ao buscar sessão de usuário:', error);
    throw new Error(`Erro ao buscar sessão: ${error.message}`);
  }
};

/**
 * Atualiza parcialmente uma sessão de usuário pelo seu ID
 * @param {string} id - ID da sessão de usuário a ser atualizada
 * @param {Object} updateData - Dados a serem atualizados na sessão
 * @returns {Promise<Object|null>} - A sessão atualizada ou null se não existir
 */
const updateUserSession = async (id, updateData) => {
  if (!id) {
    throw new Error('ID é obrigatório para atualizar sessão');
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    throw new Error('Nenhum dado fornecido para atualização');
  }

  try {
    // Obter conexão com o banco
    const db = getDbConnection();
    
    // Atualizar sessão pelo ID com apenas os campos fornecidos
    const [updatedSession] = await db('user_session')
      .where({ id })
      .update(updateData)
      .returning('*');
    
    if (!updatedSession) {
      return null;
    }

    if (!updatedSession.contact_id && updatedSession.account_id && updatedSession.phone) {
      const contactId = await ensureContactForSession(db, {
        contact_id: updatedSession.contact_id,
        name: updatedSession.name,
        phone: updatedSession.phone,
        account_id: updatedSession.account_id,
      });

      const [sessionWithContact] = await db('user_session')
        .where({ id: updatedSession.id })
        .update({ contact_id: contactId })
        .returning('*');

      if (sessionWithContact) {
        // Sobrescrever updatedSession para refletir o novo contact_id
        Object.assign(updatedSession, sessionWithContact);
      }
    }

    // Invalidar cache relacionado se houver telefone nos dados
    if (updatedSession.phone) {
      const cacheKey = `product-account:${updatedSession.phone}`;
      await invalidateCache(cacheKey);
    }
    
    return updatedSession;
  } catch (error) {
    console.error('Erro ao atualizar sessão de usuário:', error);
    throw new Error(`Erro ao atualizar sessão: ${error.message}`);
  }
};

module.exports = {
  createUserSession,
  getUserSessionById,
  updateUserSession
};
