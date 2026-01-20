const { getDbConnection } = require('../../../utils/database');
const { CheckHasExcludedProfileHelper, FindClientAdminProfileHelper } = require('./');

class AssignProfileToUserHelper {
  static async execute(userId) {
    const hasExcluded = await CheckHasExcludedProfileHelper.execute(userId);
    if (hasExcluded) {
      return;
    }

    const knex = getDbConnection();
    const existingProfiles = await knex('user_access_profiles')
      .where({ user_id: userId })
      .pluck('access_profile_id');

    const clientAdminProfile = await FindClientAdminProfileHelper.execute();
    if (!clientAdminProfile) {
      return;
    }

    const hasProfile = Array.isArray(existingProfiles) && existingProfiles.includes(clientAdminProfile.id);
    if (hasProfile) {
      return;
    }

    await knex('user_access_profiles').insert({
      user_id: userId,
      access_profile_id: clientAdminProfile.id,
    });
  }
}

module.exports = { AssignProfileToUserHelper };
