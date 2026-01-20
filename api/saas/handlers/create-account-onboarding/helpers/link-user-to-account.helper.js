const { getDbConnection } = require('../../../utils/database');
const { CheckHasExcludedProfileHelper } = require('./');

class LinkUserToAccountHelper {
  static async execute(userId, accountId) {
    const hasExcluded = await CheckHasExcludedProfileHelper.execute(userId);
    if (hasExcluded) {
      return;
    }

    const knex = getDbConnection();
    await knex('user_accounts').insert({ user_id: userId, account_id: accountId });
  }
}

module.exports = { LinkUserToAccountHelper };
