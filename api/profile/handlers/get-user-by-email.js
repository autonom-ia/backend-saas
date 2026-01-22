const { getDbConnection } = require('../utils/database');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

const getUserByEmail = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const email = event.queryStringParameters?.email;

    if (!email) {
      return createResponse(400, { message: 'Email é obrigatório.' }, getOrigin(event));
    }

    const knex = getDbConnection();

    const user = await knex('users')
      .where({ email })
      .first();

    if (!user) {
      return createResponse(404, { message: 'Usuário não encontrado.' }, getOrigin(event));
    }

    const [userCompany, accessProfiles] = await Promise.all([
      knex('user_company')
        .where({ user_id: user.id })
        .first(),
      knex('user_access_profiles')
        .where({ user_id: user.id })
        .pluck('access_profile_id')
    ]);

    const adminProfiles = await knex('access_profiles')
      .where({ admin: true })
      .pluck('id');

    const isAdmin = Array.isArray(accessProfiles) && 
                   Array.isArray(adminProfiles) &&
                   accessProfiles.some(profileId => adminProfiles.includes(profileId));

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isAdmin: isAdmin || false,
      isFirstLogin: user.is_first_login !== undefined ? user.is_first_login : true,
      companyId: userCompany?.company_id || null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return createResponse(200, { user: userData }, getOrigin(event));

  } catch (err) {
    console.error('Erro ao buscar usuário por email:', err);
    return createResponse(500, { message: 'Erro interno ao buscar usuário.', details: err.message }, getOrigin(event));
  }
};

module.exports = {
  handler: getUserByEmail,
};
