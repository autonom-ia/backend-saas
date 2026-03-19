const { getDbConnection } = require('../utils/database');

/**
 * Busca todos os produtos
 * @returns {Promise<Array>} Lista de produtos
 */
const getAllProducts = async () => {
  const knex = getDbConnection();
  return knex('product')
    .select('product.*', 'product_type.description as product_type_description', 'product_type.id as product_type_id')
    .leftJoin('product_type', 'product.product_type_id', 'product_type.id')
    .orderBy('product.created_at', 'desc');
};

const getProductsForUser = async (userId) => {
  const knex = getDbConnection();
  return knex('product as p')
    .distinct('p.*', 'product_type.description as product_type_description', 'product_type.id as product_type_id')
    .join('company as c', 'p.company_id', 'c.id')
    .join('user_company as uc', 'uc.company_id', 'c.id')
    .leftJoin('product_type', 'p.product_type_id', 'product_type.id')
    .where('uc.user_id', userId)
    .andWhere('p.is_approved', true)
    .orderBy('p.created_at', 'desc');
};

const getProductsByDomain = async (domain, isApproved) => {
  const knex = getDbConnection();
  const query = knex('product as p')
    .distinct('p.*', 'product_type.description as product_type_description', 'product_type.id as product_type_id')
    .join('company as c', 'p.company_id', 'c.id')
    .leftJoin('product_type', 'p.product_type_id', 'product_type.id')
    .where('c.domain', domain)
    .orderBy('p.created_at', 'desc');

  if (typeof isApproved !== 'undefined') {
    query.andWhere('p.is_approved', !!isApproved);
  }

  return query;
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
 * A partir do subdomínio informado, localiza a company correspondente e preenche company_id.
 * @param {Object} productData - Dados do produto
 * @param {string} productData.subdomain - Subdomínio associado à empresa do produto
 * @returns {Promise<Object>} Produto criado
 */
const createProduct = async ({ name, description, product_type_id, conversation_funnel_id, subdomain, is_approved }) => {
  const knex = getDbConnection();

  let companyId = null;
  if (subdomain) {
    const company = await knex('company').where({ domain: subdomain }).first();
    if (!company) {
      throw new Error(`Empresa não encontrada para o subdomínio: ${subdomain}`);
    }
    companyId = company.id;
  }
  
  const [newProduct] = await knex('product')
    .insert({
      name,
      description,
      product_type_id: product_type_id || null,
      company_id: companyId,
      conversation_funnel_id: conversation_funnel_id || null,
      subdomain: typeof subdomain !== 'undefined' ? subdomain : null,
      is_approved: typeof is_approved !== 'undefined' ? !!is_approved : false,
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
const updateProduct = async (id, { name, description, product_type_id, conversation_funnel_id, subdomain, is_approved }) => {
  const knex = getDbConnection();
  
  // Verificar se o produto existe
  await getProductById(id);
  
  // Construir objeto de atualização apenas com campos fornecidos
  const updateData = {
    updated_at: knex.fn.now()
  };
  
  if (typeof name !== 'undefined') {
    updateData.name = name;
  }
  
  if (typeof description !== 'undefined') {
    updateData.description = description;
  }
  
  if (typeof product_type_id !== 'undefined') {
    updateData.product_type_id = product_type_id || null;
  }
  
  if (typeof conversation_funnel_id !== 'undefined') {
    updateData.conversation_funnel_id = conversation_funnel_id || null;
  }
 
  if (typeof subdomain !== 'undefined') {
    updateData.subdomain = subdomain || null;
  }

  if (typeof is_approved !== 'undefined') {
    updateData.is_approved = !!is_approved;
  }
  
  const [updatedProduct] = await knex('product')
    .where({ id })
    .update(updateData)
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
  deleteProduct,
  getProductsByDomain,
};
