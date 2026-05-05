const { getDbConnection } = require('../utils/database');

/**
 * @param {{ accountId: string, payload: object, sentAt?: string | Date | null }} params
 */
const createAccountInteraction = async ({ accountId, payload, sentAt = null }) => {
  const knex = getDbConnection();
  const row = {
    account_id: accountId,
    payload: typeof payload === 'object' && payload !== null ? payload : { value: payload },
  };
  if (sentAt) {
    row.sent_at = sentAt instanceof Date ? sentAt : new Date(sentAt);
  }
  const [created] = await knex('account_interaction').insert(row).returning('*');
  return created;
};

const getDailyFromAccountInteraction = async ({ accountId, startDate, endDate }) => {
  const knex = getDbConnection();
  return knex('account_interaction as ai')
    .where('ai.account_id', accountId)
    .whereBetween('ai.sent_at', [startDate, endDate])
    .select(
      knex.raw("to_char(date_trunc('day', ai.sent_at), 'YYYY-MM-DD') as date"),
      knex.raw('count(*)::int as count')
    )
    .groupByRaw("date_trunc('day', ai.sent_at)")
    .orderByRaw("date_trunc('day', ai.sent_at)");
};

const getDailyUserSessionAgentMessageStats = async ({ accountId, startDate, endDate }) => {
  const knex = getDbConnection();
  return knex('user_session_agent_messages as usam')
    .join('user_session as us', 'usam.user_session_id', 'us.id')
    .where('us.account_id', accountId)
    .whereBetween('usam.sent_at', [startDate, endDate])
    .select(
      knex.raw("to_char(date_trunc('day', usam.sent_at), 'YYYY-MM-DD') as date"),
      knex.raw('count(*)::int as count')
    )
    .groupByRaw("date_trunc('day', usam.sent_at)")
    .orderByRaw("date_trunc('day', usam.sent_at)");
};

/**
 * Soma contagem por dia entre account_interaction e user_session_agent_messages.
 * @param {{ accountId: string, startDate: string, endDate: string }} params
 * @returns {Promise<Array<{ date: string, count: number }>>}
 */
const getDailyMergedAccountInteractionStats = async ({ accountId, startDate, endDate }) => {
  const [aiRows, usamRows] = await Promise.all([
    getDailyFromAccountInteraction({ accountId, startDate, endDate }),
    getDailyUserSessionAgentMessageStats({ accountId, startDate, endDate }),
  ]);

  const byDay = new Map();
  for (const r of [...(aiRows || []), ...(usamRows || [])]) {
    const d = String(r.date).slice(0, 10);
    const c = Number(r.count) || 0;
    byDay.set(d, (byDay.get(d) || 0) + c);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
};

module.exports = {
  createAccountInteraction,
  getDailyMergedAccountInteractionStats,
  getDailyFromAccountInteraction,
  getDailyUserSessionAgentMessageStats,
};
