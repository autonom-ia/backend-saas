const { getDbConnection } = require('../utils/database');

/**
 * Lista parâmetros de produto filtrando por product_id
 * @param {string} productId
 */
const getAllProductParameters = async (productId) => {
  const knex = getDbConnection();
  return knex('product_parameter')
    .select('*')
    .where({ product_id: productId })
    .orderBy('created_at', 'desc');
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
 * @param {{ name: string, value: string, product_id: string }} data
 */
const createProductParameter = async ({ name, value, product_id }) => {
  const knex = getDbConnection();
  if (!name || !product_id) {
    throw new Error('Campos obrigatórios: name, product_id');
  }
  const [created] = await knex('product_parameter')
    .insert({ name, value: value ?? '', product_id })
    .returning('*');
  return created;
};

/**
 * Atualiza um parâmetro de produto
 * @param {string} id
 * @param {{ name?: string, value?: string, product_id?: string }} data
 */
const updateProductParameter = async (id, { name, value, product_id }) => {
  const knex = getDbConnection();
  await getProductParameterById(id);
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (value !== undefined) updateData.value = value;
  if (product_id !== undefined) updateData.product_id = product_id;
  // Opcionalmente atualiza updated_at
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
