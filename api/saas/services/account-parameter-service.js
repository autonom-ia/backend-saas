const { getDbConnection } = require('../utils/database');

/**
 * Lista parâmetros de conta filtrando por account_id
 * Ordenação: alfabética por short_description, depois por name
 * @param {string} accountId
 */
const getAllAccountParameters = async (accountId) => {
  const knex = getDbConnection();
  return knex('account_parameter')
    .select('*')
    .where({ account_id: accountId })
    .orderBy([
      { column: 'short_description', order: 'asc', nulls: 'last' },
      { column: 'name', order: 'asc' }
    ]);
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
 * @param {{ name: string, value: string, account_id: string, short_description?: string, help_text?: string, default_value?: string }} data
 */
const createAccountParameter = async ({ name, value, account_id, short_description, help_text, default_value }) => {
  const knex = getDbConnection();
  if (!name || !account_id) {
    throw new Error('Campos obrigatórios: name, account_id');
  }
  
  const insertData = {
    name,
    value: value ?? '',
    account_id
  };
  
  // Adicionar campos opcionais se fornecidos
  if (short_description !== undefined) insertData.short_description = short_description;
  if (help_text !== undefined) insertData.help_text = help_text;
  if (default_value !== undefined) insertData.default_value = default_value;
  
  const [created] = await knex('account_parameter')
    .insert(insertData)
    .returning('*');
  return created;
};

/**
 * Atualiza um parâmetro de conta
 * @param {string} id
 * @param {{ name?: string, value?: string, account_id?: string, short_description?: string, help_text?: string, default_value?: string }} data
 */
const updateAccountParameter = async (id, { name, value, account_id, short_description, help_text, default_value }) => {
  const knex = getDbConnection();
  await getAccountParameterById(id);
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (value !== undefined) updateData.value = value;
  if (account_id !== undefined) updateData.account_id = account_id;
  if (short_description !== undefined) updateData.short_description = short_description;
  if (help_text !== undefined) updateData.help_text = help_text;
  if (default_value !== undefined) updateData.default_value = default_value;
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
