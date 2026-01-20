const { getDbConnection } = require('../../../utils/database');

class UpdateFirstLoginStatusHelper {
  static async execute(userId) {
    const knex = getDbConnection();
    const user = await knex('users').where({ id: userId }).first();

    if (!user || !user.is_first_login) {
      return;
    }

    await knex('users')
      .where({ id: userId })
      .update({
        is_first_login: false,
        updated_at: knex.fn.now(),
      });
  }
}

module.exports = { UpdateFirstLoginStatusHelper };
