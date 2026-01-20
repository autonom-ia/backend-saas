const { getDbConnection } = require('../utils/database');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

module.exports.handler = async (event) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const origin = getOrigin(event);
    const knex = getDbConnection();

    const profiles = await knex('access_profiles')
      .select('*')
      .orderBy('name', 'asc');

    console.log(`[list-access-profiles] Retornando ${profiles.length} perfis de acesso`);
    
    return createResponse(200, profiles, origin);
  } catch (error) {
    console.error('[list-access-profiles] Erro ao listar perfis de acesso:', error);
    const origin = getOrigin(event);
    return createResponse(500, {
      message: 'Erro ao listar perfis de acesso',
      error: error.message,
    }, origin);
  }
};
