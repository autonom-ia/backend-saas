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

    const userProfileIds = await knex('user_access_profiles')
      .where({ user_id: user.id })
      .pluck('access_profile_id');

    const adminProfileRow =
      userProfileIds?.length > 0
        ? await knex('access_profiles')
            .whereIn('id', userProfileIds)
            .where({ admin: true })
            .first()
        : null;
    const isAdmin = !!adminProfileRow;

    const userAccounts = await knex('user_accounts')
      .where({ user_id: user.id })
      .select('account_id', 'has_chat_support');

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isAdmin,
      isFirstLogin: user.is_first_login !== undefined ? user.is_first_login : true,
      created_at: user.created_at,
      updated_at: user.updated_at,
      user_accounts: userAccounts.map(account => ({ account_id: account.account_id, has_chat_support: account.has_chat_support })),
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
