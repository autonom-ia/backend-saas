const { getDbConnection } = require('../../../utils/database');
const {
  GetEffectiveUserIdHelper,
  AssignProfileToUserHelper,
  LinkUserToAccountHelper,
  UpdateFirstLoginStatusHelper,
} = require('./');

class RelateUserToAccountHelper {
  static async execute(event, user_id, accountId) {
    try {
      const effectiveUserId = await GetEffectiveUserIdHelper.execute(event, user_id);
      if (!effectiveUserId) {
        return;
      }

      const knex = getDbConnection();
      const user = await knex('users').where({ id: effectiveUserId }).first();
      if (!user) {
        return;
      }

      await AssignProfileToUserHelper.execute(effectiveUserId);
      await LinkUserToAccountHelper.execute(effectiveUserId, accountId);
      await UpdateFirstLoginStatusHelper.execute(effectiveUserId);
    } catch (relErr) {
      console.error('[create-account-onboarding] Falha ao relacionar usuário:', relErr?.message || relErr);
    }
  }
}

module.exports = { RelateUserToAccountHelper };
