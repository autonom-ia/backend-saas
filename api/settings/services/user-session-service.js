/**
 * Serviço para gerenciar as sessões de usuários
 */
const { getDbConnection } = require('../utils/database');
const { getCache, invalidateCache } = require('../utils/cache');

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
    
    // Verificar se já existe uma sessão com o mesmo telefone para a conta especificada
    console.log(`Verificando se já existe uma sessão para o telefone ${sessionData.phone} na conta ${sessionData.account_id}...`);
    const existingSession = await db('user_session')
      .where({
        'phone': sessionData.phone,
        'account_id': sessionData.account_id
      })
      .first();
    
    // Se já existe uma sessão, retorna ela em vez de criar uma nova
    if (existingSession) {
      console.log(`Sessão existente encontrada com ID: ${existingSession.id}`);
      return existingSession;
    }
    
    console.log('Nenhuma sessão existente encontrada. Criando nova sessão...');
    
    // Preparar dados para inserção
    const newSession = {
      name: sessionData.name,
      phone: sessionData.phone,
      account_id: sessionData.account_id,
      product_id: sessionData.product_id,
      created_at: new Date()
      // A tabela user_session não possui o campo updated_at
    };
    
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
