const { getDbConnection } = require('../../../utils/database');
const { createInbox } = require('../../../services/inbox-service');

class CreateInboxIfNeededHelper {
  static async execute(accountId, accountPhone) {
    const phoneTrimmed = accountPhone.toString().trim();
    if (!phoneTrimmed) {
      return;
    }

    try {
      const knex = getDbConnection();
      const exists = await knex('inbox')
        .where({ account_id: accountId, name: phoneTrimmed })
        .first();

      if (!exists) {
        await createInbox({ account_id: accountId, name: phoneTrimmed });
      }
    } catch (inbErr) {
      console.error('[create-account-onboarding] Falha ao criar inbox:', inbErr?.message || inbErr);
    }
  }
}

module.exports = { CreateInboxIfNeededHelper };
