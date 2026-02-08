const { getDbConnection } = require('../utils/database');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

/**
 * GET /Autonomia/Profile/AccessProfiles
 * Público: usado na página de registro antes do usuário existir, para obter o perfil de acesso padrão.
 */
const getAccessProfiles = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const knex = getDbConnection();
    const profiles = await knex('access_profiles')
      .select('id', 'name', 'admin')
      .orderBy('name', 'asc');

    return createResponse(200, profiles, getOrigin(event));
  } catch (err) {
    console.error('Erro ao buscar perfis de acesso:', err);
    return createResponse(500, { message: 'Erro interno ao buscar perfis de acesso.', details: err.message }, getOrigin(event));
  }
};

module.exports = {
  handler: getAccessProfiles,
};
