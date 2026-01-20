const { getDbConnection } = require('../../../utils/database');

class CheckHasExcludedProfileHelper {
  static async execute(userId) {
    const EXCLUDED_PROFILE = 'b36dd047-1634-4a89-97f3-127688104dd0';
    const knex = getDbConnection();
    const existingProfiles = await knex('user_access_profiles')
      .where({ user_id: userId })
      .pluck('access_profile_id');

    return Array.isArray(existingProfiles) && existingProfiles.includes(EXCLUDED_PROFILE);
  }
}

module.exports = { CheckHasExcludedProfileHelper };
