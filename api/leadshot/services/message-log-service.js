const { getDbConnection } = require('../utils/database');

async function createMessageLog({ campaign_id, user_session_id, phone_number, success = false, error = null }) {
  const knex = getDbConnection();
  const [row] = await knex('message_logs')
    .insert({ campaign_id, user_session_id, phone_number, success, error })
    .returning(['id', 'campaign_id', 'user_session_id', 'phone_number', 'success', 'error', 'created_at']);
  return row;
}

module.exports = {
  createMessageLog,
};
