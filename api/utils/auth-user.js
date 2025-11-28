const { getDbConnection } = require('./database');

async function getUserFromEvent(event) {
  const claims =
    event?.requestContext?.authorizer?.claims ||
    event?.requestContext?.authorizer?.jwt?.claims ||
    {};

  const email = claims.email || claims['cognito:username'] || null;
  if (!email) {
    return null;
  }

  const knex = getDbConnection();
  const user = await knex('users').where({ email }).first();
  if (!user) {
    return null;
  }

  return { user, claims };
}

module.exports = {
  getUserFromEvent,
};
