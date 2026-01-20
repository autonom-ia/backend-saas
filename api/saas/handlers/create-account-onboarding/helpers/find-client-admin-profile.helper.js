const { getDbConnection } = require('../../../utils/database');

class FindClientAdminProfileHelper {
  static async execute() {
    const EXCLUDED_PROFILE = 'b36dd047-1634-4a89-97f3-127688104dd0';
    const DEFAULT_PROFILE_ID = 'e8cbb607-4a3a-44c6-8669-a5c6d2bd5e17';
    const knex = getDbConnection();

    const clientAdminProfile = await knex('access_profiles')
      .where({ admin: true })
      .whereNot('id', EXCLUDED_PROFILE)
      .first();

    if (clientAdminProfile) {
      return clientAdminProfile;
    }

    const anyAdminProfile = await knex('access_profiles').where({ admin: true }).first();
    if (anyAdminProfile) {
      return anyAdminProfile;
    }

    const defaultProfile = await knex('access_profiles').where({ id: DEFAULT_PROFILE_ID }).first();
    return defaultProfile || null;
  }
}

module.exports = { FindClientAdminProfileHelper };
