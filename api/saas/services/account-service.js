const { getDbConnection } = require('../utils/database');

/**
 * Lista contas filtrando por product_id
 * @param {string} productId
 * @returns {Promise<Array>} Lista de contas
 */
const getAllAccounts = async (productId) => {
  const knex = getDbConnection();
  return knex('account')
    .select('*')
    .where({ product_id: productId })
    .orderBy('created_at', 'desc');
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

module.exports = {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
};
