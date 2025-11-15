const { getDbConnection } = require('../utils/database');

/**
 * Lista todos os parâmetros padrão de produto
 * @param {boolean} visibleOnboardingOnly - Se true, retorna apenas os visíveis no onboarding
 */
const getAllProductParametersStandard = async (visibleOnboardingOnly = false) => {
  const knex = getDbConnection();
  let query = knex('product_parameters_standard').select('*');
  
  if (visibleOnboardingOnly) {
    query = query.where({ visible_onboarding: true });
  }
  
  return query.orderBy('created_at', 'asc');
};

/**
 * Busca um parâmetro padrão por ID
 * @param {string} id
 */
const getProductParameterStandardById = async (id) => {
  const knex = getDbConnection();
  const item = await knex('product_parameters_standard').where({ id }).first();
  if (!item) throw new Error('Parâmetro padrão de produto não encontrado');
  return item;
};

/**
 * Busca um parâmetro padrão por nome
 * @param {string} name
 */
const getProductParameterStandardByName = async (name) => {
  const knex = getDbConnection();
  const item = await knex('product_parameters_standard').where({ name }).first();
  return item || null;
};

module.exports = {
  getAllProductParametersStandard,
  getProductParameterStandardById,
  getProductParameterStandardByName,
};
