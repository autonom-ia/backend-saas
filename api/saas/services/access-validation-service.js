const { getDbConnection } = require('../utils/database');
const { getUserPermissions, hasCompanyAccess, hasDomainAccess } = require('./user-company-service');

/**
 * Valida acesso a um produto através dos relacionamentos:
 * product -> company -> user_company -> user
 * @param {string} userId - ID do usuário
 * @param {string} productId - ID do produto
 * @param {boolean} canSeeAll - Se o usuário pode ver todos os produtos
 * @returns {Promise<boolean>} true se tiver acesso
 */
const validateProductAccess = async (userId, productId, canSeeAll) => {
  if (canSeeAll) {
    return true;
  }
  
  const knex = getDbConnection();
  
  // Busca o company_id do produto através do relacionamento product -> company
  const product = await knex('product')
    .where({ id: productId })
    .select('company_id')
    .first();
  
  if (!product || !product.company_id) {
    return false;
  }
  
  return hasCompanyAccess(knex, userId, product.company_id, canSeeAll);
};

/**
 * Valida acesso a uma conta através dos relacionamentos:
 * account -> product -> company -> user_company -> user
 * @param {string} userId - ID do usuário
 * @param {string} accountId - ID da conta
 * @param {boolean} canSeeAll - Se o usuário pode ver todas as contas
 * @returns {Promise<boolean>} true se tiver acesso
 */
const validateAccountAccess = async (userId, accountId, canSeeAll) => {
  if (canSeeAll) {
    return true;
  }
  
  const knex = getDbConnection();
  
  // Busca o company_id através dos relacionamentos account -> product -> company
  const accountCompany = await knex('account')
    .where({ 'account.id': accountId })
    .join('product', 'account.product_id', 'product.id')
    .select('product.company_id')
    .first();
  
  if (!accountCompany || !accountCompany.company_id) {
    return false;
  }
  
  return hasCompanyAccess(knex, userId, accountCompany.company_id, canSeeAll);
};

/**
 * Valida acesso para criar um produto em um domain específico
 * @param {string} userId - ID do usuário
 * @param {string} domain - Domain onde o produto será criado
 * @param {boolean} canSeeAll - Se o usuário pode criar em qualquer domain
 * @returns {Promise<boolean>} true se tiver acesso
 */
const validateProductCreationAccess = async (userId, domain, canSeeAll) => {
  if (canSeeAll) {
    return true;
  }
  
  const knex = getDbConnection();
  return hasDomainAccess(knex, userId, domain, canSeeAll);
};

/**
 * Busca permissões do usuário e valida acesso a um produto
 * @param {string} userId - ID do usuário
 * @param {string} productId - ID do produto
 * @returns {Promise<{hasAccess: boolean, permissions: Object}>}
 */
const validateProductAccessWithPermissions = async (userId, productId) => {
  const permissions = await getUserPermissions(userId);
  const hasAccess = await validateProductAccess(userId, productId, permissions.canSeeAll);
  
  return {
    hasAccess,
    permissions
  };
};

/**
 * Busca permissões do usuário e valida acesso a uma conta
 * @param {string} userId - ID do usuário
 * @param {string} accountId - ID da conta
 * @returns {Promise<{hasAccess: boolean, permissions: Object}>}
 */
const validateAccountAccessWithPermissions = async (userId, accountId) => {
  const permissions = await getUserPermissions(userId);
  const hasAccess = await validateAccountAccess(userId, accountId, permissions.canSeeAll);
  
  return {
    hasAccess,
    permissions
  };
};

module.exports = {
  validateProductAccess,
  validateAccountAccess,
  validateProductCreationAccess,
  validateProductAccessWithPermissions,
  validateAccountAccessWithPermissions
};
