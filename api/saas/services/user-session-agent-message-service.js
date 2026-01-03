const { getDbConnection } = require('../utils/database');

const createUserSessionAgentMessage = async ({ userSessionId, message }) => {
  const knex = getDbConnection();

  const [created] = await knex('user_session_agent_messages')
    .insert({
      user_session_id: userSessionId,
      message,
    })
    .returning('*');

  return created;
};

const getDailyUserSessionAgentMessageStats = async ({ accountId, startDate, endDate }) => {
  const knex = getDbConnection();

  const rows = await knex('user_session_agent_messages as usam')
    .join('user_session as us', 'usam.user_session_id', 'us.id')
    .where('us.account_id', accountId)
    .whereBetween('usam.sent_at', [startDate, endDate])
    .select(
      knex.raw("to_char(date_trunc('day', usam.sent_at), 'YYYY-MM-DD') as date"),
      knex.raw('count(*)::int as count')
    )
    .groupByRaw("date_trunc('day', usam.sent_at)")
    .orderByRaw("date_trunc('day', usam.sent_at)");

  return rows;
};

module.exports = {
  createUserSessionAgentMessage,
  getDailyUserSessionAgentMessageStats,
};
