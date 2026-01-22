const { getDbConnection } = require('../utils/database');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

const updateFirstLogin = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const userId = event.pathParameters?.userId;
    const body = JSON.parse(event.body || '{}');
    const { isFirstLogin } = body;

    if (!userId) {
      return createResponse(400, { message: 'User ID é obrigatório.' }, getOrigin(event));
    }

    if (typeof isFirstLogin !== 'boolean') {
      return createResponse(400, { message: 'isFirstLogin deve ser um booleano.' }, getOrigin(event));
    }

    const knex = getDbConnection();

    const user = await knex('users')
      .where({ id: userId })
      .first();

    if (!user) {
      return createResponse(404, { message: 'Usuário não encontrado.' }, getOrigin(event));
    }

    await knex('users')
      .where({ id: userId })
      .update({
        is_first_login: isFirstLogin,
        updated_at: knex.fn.now()
      });

    return createResponse(200, { message: 'Primeiro login atualizado com sucesso.' }, getOrigin(event));

  } catch (err) {
    console.error('Erro ao atualizar primeiro login:', err);
    return createResponse(500, { message: 'Erro interno ao atualizar primeiro login.', details: err.message }, getOrigin(event));
  }
};

module.exports = {
  handler: updateFirstLogin,
};
