const { getDbConnection } = require('../utils/database');

/**
 * Lista todos os parâmetros padrão de conta
 * @param {boolean} visibleOnboardingOnly - Se true, retorna apenas os visíveis no onboarding
 */
const getAllAccountParametersStandard = async (visibleOnboardingOnly = false) => {
  const knex = getDbConnection();
  let query = knex('account_parameters_standard').select('*');
  
  if (visibleOnboardingOnly) {
    query = query.where({ visible_onboarding: true });
  }
  
  return query.orderBy('created_at', 'asc');
};

/**
 * Busca um parâmetro padrão por ID
 * @param {string} id
 */
const getAccountParameterStandardById = async (id) => {
  const knex = getDbConnection();
  const item = await knex('account_parameters_standard').where({ id }).first();
  if (!item) throw new Error('Parâmetro padrão de conta não encontrado');
  return item;
};

/**
 * Busca um parâmetro padrão por nome
 * @param {string} name
 */
const getAccountParameterStandardByName = async (name) => {
  const knex = getDbConnection();
  const item = await knex('account_parameters_standard').where({ name }).first();
  return item || null;
};

module.exports = {
  getAllAccountParametersStandard,
  getAccountParameterStandardById,
  getAccountParameterStandardByName,
};
