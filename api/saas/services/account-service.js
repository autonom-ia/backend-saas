const { getDbConnection } = require('../utils/database');

// Mesmo perfil admin usado no módulo clients
const ADMIN_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';

/**
 * Lista contas filtrando por product_id ou domain
 * @param {Object} filters - Filtros de busca
 * @param {string} [filters.productId] - ID do produto
 * @param {string} [filters.domain] - Domínio da conta
 * @returns {Promise<Array>} Lista de contas
 */
const getAllAccounts = async (filters = {}) => {
  const knex = getDbConnection();
  const query = knex('account').select('account.*', 'product.name as product_name').join('product', 'account.product_id', 'product.id');
  
  if (filters.productId) {
    query.where({ product_id: filters.productId });
  }
  
  if (filters.domain) {
    query.where({ domain: filters.domain });
  }
  
  // Se nenhum filtro foi fornecido, retorna todas as contas
  return query.orderBy('created_at', 'desc');
};

/**
 * Busca uma conta por ID
 * @param {string} id
 * @returns {Promise<Object>}
 */
const getAccountById = async (id) => {
  const knex = getDbConnection();
  const account = await knex('account').where({ id }).first();
  if (!account) {
    throw new Error('Conta não encontrada');
  }
  return account;
};

/**
 * Cria uma conta
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const createAccount = async ({ social_name, name, email, phone, product_id, document, instance, conversation_funnel_id, domain }) => {
  const knex = getDbConnection();
  const [newAccount] = await knex('account')
    .insert({ social_name, name, email, phone, product_id, document, instance, conversation_funnel_id, domain })
    .returning('*');
  return newAccount;
};

/**
 * Atualiza uma conta
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const updateAccount = async (id, { social_name, name, email, phone, product_id, document, instance, conversation_funnel_id }) => {
  const knex = getDbConnection();

  // Garante existência
  await getAccountById(id);

  // Monta objeto apenas com campos fornecidos
  const updateData = {};
  if (social_name !== undefined) updateData.social_name = social_name;
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (product_id !== undefined) updateData.product_id = product_id;
  if (document !== undefined) updateData.document = document;
  if (instance !== undefined) updateData.instance = instance;
  if (conversation_funnel_id !== undefined) updateData.conversation_funnel_id = conversation_funnel_id;

  // Logs de diagnóstico para verificar o payload de atualização
  try {
    console.log('[updateAccount] accountId:', id);
    console.log('[updateAccount] updateData:', JSON.stringify(updateData));
  } catch (_) {
    // Ignora erros de stringify, mas não quebra a execução
  }

  const [updated] = await knex('account')
    .where({ id })
    .update(updateData)
    .returning('*');

  return updated;
};

/**
 * Remove uma conta
 * @param {string} id
 * @returns {Promise<boolean>}
 */
const deleteAccount = async (id) => {
  const knex = getDbConnection();
  await getAccountById(id);
  await knex('account').where({ id }).delete();
  return true;
};

// Retorna contexto de acesso do usuário (admin ou não) usando user_access_profiles
const getUserAccessContext = async (knex, userId) => {
  const profileIds = await knex('user_access_profiles')
    .where({ user_id: userId })
    .pluck('access_profile_id');
  const isAdmin = Array.isArray(profileIds) && profileIds.includes(ADMIN_PROFILE_ID);
  return { isAdmin };
};

// Lista apenas as contas acessíveis ao usuário.
// Admin: mesmo comportamento de getAllAccounts.
// Não admin: filtra por user_accounts.user_id = userId.
const getAccountsForUser = async (userId, filters = {}) => {
  const knex = getDbConnection();
  const { isAdmin } = await getUserAccessContext(knex, userId);

  let query = knex('account')
    .select('account.*', 'product.name as product_name')
    .join('product', 'account.product_id', 'product.id');

  if (!isAdmin) {
    query = query
      .join('user_accounts as ua', 'ua.account_id', 'account.id')
      .where('ua.user_id', userId);
  }

  if (filters.productId) {
    query.where({ product_id: filters.productId });
  }

  if (filters.domain) {
    query.where({ domain: filters.domain });
  }

  return query.orderBy('account.created_at', 'desc');
};

module.exports = {
  getAllAccounts,
  getAccountsForUser,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
};
