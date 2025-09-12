const { getDbConnection } = require('../utils/database');

/**
 * Busca todos os produtos
 * @returns {Promise<Array>} Lista de produtos
 */
const getAllProducts = async () => {
  const knex = getDbConnection();
  return knex('product').select('*').orderBy('created_at', 'desc');
};

/**
 * Busca produtos relacionados às contas do usuário
 * user_id refere-se ao ID na tabela users (mesmo usado em user_accounts)
 * Retorna produtos distintos associados às contas do usuário
 * @param {string} userId
 * @returns {Promise<Array>}
 */
const getProductsForUser = async (userId) => {
  const knex = getDbConnection();
  return knex('product as p')
    .distinct('p.*')
    .join('account as a', 'a.product_id', 'p.id')
    .join('user_accounts as ua', 'ua.account_id', 'a.id')
    .where('ua.user_id', userId)
    .orderBy('p.created_at', 'desc');
};

/**
 * Busca um produto pelo ID
 * @param {string} id - ID do produto
 * @returns {Promise<Object>} Produto encontrado
 */
const getProductById = async (id) => {
  const knex = getDbConnection();
  const product = await knex('product').where({ id }).first();
  
  if (!product) {
    throw new Error('Produto não encontrado');
  }
  
  return product;
};

/**
 * Cria um novo produto
 * @param {Object} productData - Dados do produto
 * @returns {Promise<Object>} Produto criado
 */
const createProduct = async ({ name, description }) => {
  const knex = getDbConnection();
  
  const [newProduct] = await knex('product')
    .insert({
      name,
      description
    })
    .returning('*');
  
  return newProduct;
};

/**
 * Atualiza um produto existente
 * @param {string} id - ID do produto
 * @param {Object} productData - Dados do produto a atualizar
 * @returns {Promise<Object>} Produto atualizado
 */
const updateProduct = async (id, { name, description }) => {
  const knex = getDbConnection();
  
  // Verificar se o produto existe
  await getProductById(id);
  
  const [updatedProduct] = await knex('product')
    .where({ id })
    .update({
      name,
      description,
      updated_at: knex.fn.now()
    })
    .returning('*');
  
  return updatedProduct;
};

/**
 * Remove um produto pelo ID
 * @param {string} id - ID do produto
 * @returns {Promise<boolean>} Resultado da operação
 */
const deleteProduct = async (id) => {
  const knex = getDbConnection();
  
  // Verificar se o produto existe
  await getProductById(id);
  
  await knex('product').where({ id }).delete();
  
  return true;
};

module.exports = {
  getAllProducts,
  getProductsForUser,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
