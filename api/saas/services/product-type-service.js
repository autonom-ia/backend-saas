const { getDbConnection } = require('../utils/database');

/**
 * Lista todos os tipos de produto
 * @returns {Promise<Array>} Lista de tipos de produto
 */
const listProductTypes = async () => {
  const knex = getDbConnection();
  return knex('product_type').select('*').orderBy('description', 'asc');
};

module.exports = { listProductTypes };
