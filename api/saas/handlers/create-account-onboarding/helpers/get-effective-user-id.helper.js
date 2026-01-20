const { getUserFromEvent } = require('../../../utils/auth-user');

class GetEffectiveUserIdHelper {
  static async execute(event, user_id) {
    try {
      const userContext = await getUserFromEvent(event);
      const jwtUserId = userContext && userContext.user && userContext.user.id;
      return jwtUserId || user_id;
    } catch {
      return user_id;
    }
  }
}

module.exports = { GetEffectiveUserIdHelper };
