const { getDbConnection } = require('../utils/database');

/**
 * Lista parâmetros de produto filtrando por product_id
 * Ordenação: alfabética por short_description, depois por name
 * @param {string} productId
 */
const getAllProductParameters = async (productId) => {
  const knex = getDbConnection();
  return knex('product_parameter')
    .select('*')
    .where({ product_id: productId })
    .orderBy([
      { column: 'short_description', order: 'asc', nulls: 'last' },
      { column: 'name', order: 'asc' }
    ]);
};

/**
 * Busca um parâmetro por ID
 * @param {string} id
 */
const getProductParameterById = async (id) => {
  const knex = getDbConnection();
  const item = await knex('product_parameter').where({ id }).first();
  if (!item) throw new Error('Parâmetro não encontrado');
  return item;
};

/**
 * Cria um parâmetro de produto
 * @param {{ name: string, value: string, product_id: string, short_description?: string, help_text?: string, default_value?: string }} data
 */
const createProductParameter = async ({ name, value, product_id, short_description, help_text, default_value }) => {
  const knex = getDbConnection();
  if (!name || !product_id) {
    throw new Error('Campos obrigatórios: name, product_id');
  }
  
  const insertData = {
    name,
    value: value ?? '',
    product_id
  };
  
  // Adicionar campos opcionais se fornecidos
  if (short_description !== undefined) insertData.short_description = short_description;
  if (help_text !== undefined) insertData.help_text = help_text;
  if (default_value !== undefined) insertData.default_value = default_value;
  
  const [created] = await knex('product_parameter')
    .insert(insertData)
    .returning('*');
  return created;
};

/**
 * Atualiza um parâmetro de produto
 * @param {string} id
 * @param {{ name?: string, value?: string, product_id?: string, short_description?: string, help_text?: string, default_value?: string }} data
 */
const updateProductParameter = async (id, { name, value, product_id, short_description, help_text, default_value }) => {
  const knex = getDbConnection();
  await getProductParameterById(id);
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (value !== undefined) updateData.value = value;
  if (product_id !== undefined) updateData.product_id = product_id;
  if (short_description !== undefined) updateData.short_description = short_description;
  if (help_text !== undefined) updateData.help_text = help_text;
  if (default_value !== undefined) updateData.default_value = default_value;
  updateData.updated_at = knex.fn.now();
  const [updated] = await knex('product_parameter')
    .where({ id })
    .update(updateData)
    .returning('*');
  return updated;
};

/**
 * Remove um parâmetro de produto
 * @param {string} id
 */
const deleteProductParameter = async (id) => {
  const knex = getDbConnection();
  await getProductParameterById(id);
  await knex('product_parameter').where({ id }).delete();
  return true;
};

module.exports = {
  getAllProductParameters,
  getProductParameterById,
  createProductParameter,
  updateProductParameter,
  deleteProductParameter,
};
