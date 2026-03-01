const { getDbConnection } = require('../utils/database');

/**
 * Lista inboxes filtrando por accountId
 * @param {string} accountId
 * @returns {Promise<Array>}
 */
const listInboxes = async (accountId) => {
  if (!accountId) {
    throw new Error('accountId é obrigatório');
  }
  const knex = getDbConnection();
  return knex('inbox')
    .where({ account_id: accountId })
    .select('*')
    .orderBy('created_at', 'desc');
};

/**
 * Busca um inbox por ID
 * @param {string} id
 * @returns {Promise<Object>}
 */
const getInboxById = async (id) => {
  const knex = getDbConnection();
  const inbox = await knex('inbox').where({ id }).first();
  if (!inbox) {
    throw new Error('Inbox não encontrado');
  }
  return inbox;
};

/**
 * Cria um novo inbox
 * @param {{ account_id: string, name: string, notification_email?: string, contact_name?: string }} data
 * @returns {Promise<Object>}
 */
const createInbox = async ({ account_id, name, notification_email, contact_name }) => {
  if (!account_id || !name) {
    throw new Error('account_id e name são obrigatórios');
  }

  const knex = getDbConnection();
  const payload = {
    account_id,
    name,
  };

  if (typeof notification_email === 'string') {
    payload.notification_email = notification_email || null;
  }

  if (typeof contact_name === 'string') {
    payload.contact_name = contact_name || null;
  }

  const [created] = await knex('inbox')
    .insert(payload)
    .returning('*');
  return created;
};

/**
 * Atualiza um inbox
 * @param {string} id
 * @param {{ account_id?: string, name?: string, notification_email?: string | null, contact_name?: string | null }} data
 * @returns {Promise<Object>}
 */
const updateInbox = async (id, { account_id, name, notification_email, contact_name }) => {
  const knex = getDbConnection();
  // garante existência
  await getInboxById(id);

  const update = {};
  if (account_id !== undefined) update.account_id = account_id;
  if (name !== undefined) update.name = name;
  if (notification_email !== undefined) {
    update.notification_email = notification_email || null;
  }
  if (contact_name !== undefined) {
    update.contact_name = contact_name || null;
  }
  if (Object.keys(update).length === 0) {
    throw new Error('Nenhum campo para atualizar');
  }

  const [updated] = await knex('inbox')
    .where({ id })
    .update({ ...update, updated_at: knex.fn.now() })
    .returning('*');
  return updated;
};

/**
 * Remove um inbox
 * @param {string} id
 * @returns {Promise<boolean>}
 */
const deleteInbox = async (id) => {
  const knex = getDbConnection();
  await getInboxById(id);
  await knex('inbox').where({ id }).delete();
  return true;
};

module.exports = {
  listInboxes,
  getInboxById,
  createInbox,
  updateInbox,
  deleteInbox,
};
