const { getDbConnection } = require('../utils/database');

/**
 * Lista parâmetros de conta filtrando por account_id
 * @param {string} accountId
 */
const getAllAccountParameters = async (accountId) => {
  const knex = getDbConnection();
  return knex('account_parameter')
    .select('*')
    .where({ account_id: accountId })
    .orderBy('created_at', 'desc');
};

/**
 * Busca o valor de um parâmetro específico por name dentro de uma account
 * @param {string} accountId
 * @param {string} name
 */
const getAccountParameterByName = async (accountId, name) => {
  const knex = getDbConnection();
  const row = await knex('account_parameter')
    .select('*')
    .where({ account_id: accountId, name })
    .orderBy('created_at', 'desc')
    .first();
  return row || null;
};

/**
 * Busca um parâmetro por ID
 * @param {string} id
 */
const getAccountParameterById = async (id) => {
  const knex = getDbConnection();
  const item = await knex('account_parameter').where({ id }).first();
  if (!item) throw new Error('Parâmetro de conta não encontrado');
  return item;
};

/**
 * Cria um parâmetro de conta
 * @param {{ name: string, value: string, account_id: string }} data
 */
const createAccountParameter = async ({ name, value, account_id }) => {
  const knex = getDbConnection();
  if (!name || !account_id) {
    throw new Error('Campos obrigatórios: name, account_id');
  }
  const [created] = await knex('account_parameter')
    .insert({ name, value: value ?? '', account_id })
    .returning('*');
  return created;
};

/**
 * Atualiza um parâmetro de conta
 * @param {string} id
 * @param {{ name?: string, value?: string, account_id?: string }} data
 */
const updateAccountParameter = async (id, { name, value, account_id }) => {
  const knex = getDbConnection();
  await getAccountParameterById(id);
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (value !== undefined) updateData.value = value;
  if (account_id !== undefined) updateData.account_id = account_id;
  updateData.updated_at = knex.fn.now();
  const [updated] = await knex('account_parameter')
    .where({ id })
    .update(updateData)
    .returning('*');
  return updated;
};

/**
 * Remove um parâmetro de conta
 * @param {string} id
 */
const deleteAccountParameter = async (id) => {
  const knex = getDbConnection();
  await getAccountParameterById(id);
  await knex('account_parameter').where({ id }).delete();
  return true;
};

module.exports = {
  getAllAccountParameters,
  getAccountParameterByName,
  getAccountParameterById,
  createAccountParameter,
  updateAccountParameter,
  deleteAccountParameter,
};
