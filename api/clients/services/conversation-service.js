const knex = require('knex');
const { getDbConnection } = require('../utils/database');


async function createChatwootDbConnection(identifier) {
  try {
    const db = getDbConnection();
    const raw = String(identifier || '');
    const isNumeric = /^\d+$/.test(raw);
    let accountId;
    if (isNumeric) {
      accountId = raw;
    } else {
      const normalizedPrefix = raw.replace(/^\/+|\/+$/g, '');
      // prefix -> account_id
      const prefixParam = await db('account_parameter')
        .select('account_id')
        .where({ name: 'prefix-parameter', value: normalizedPrefix })
        .first();
      if (!prefixParam) throw new Error(`Conta não encontrada para o prefixo '${normalizedPrefix}'`);
      accountId = prefixParam.account_id;
    }

    // host
    const hostParam = await db('account_parameter')
      .select('value')
      .where({ account_id: accountId, name: 'chatwoot_db_host' })
      .first();
    if (!hostParam || !hostParam.value) throw new Error(`Parâmetro 'chatwoot_db_host' não encontrado`);

    const host = hostParam.value;
    const port = 5432;
    const database = 'chatwoot';
    const user = 'postgres';
    const password = 'Mfcd62!!Mfcd62!!';

    const chatwootDb = knex({
      client: 'pg',
      connection: { host, port, database, user, password, ssl: false },
      pool: { min: 0, max: 2 }
    });

    await chatwootDb.raw('SELECT 1');
    return chatwootDb;
  } catch (error) {
    console.error('Erro ao criar conexão com banco de dados do Chatwoot:', error);
    throw new Error(`Erro ao criar conexão com banco de dados do Chatwoot: ${error.message}`);
  }
}

async function getConversations(accountId, startDate, endDate) {
  let chatwootDb;
  try {
    chatwootDb = await createChatwootDbConnection(accountId);

    const query = `
      select c.id, c.display_id, c.contact_id, c2.name as contact_name, c2.phone_number, c.assignee_id, u."name" as assignee_name, tm2.id as team_id, t.name as team_name, c.inbox_id, i.name as inbox_name, m.manager_id, m.manager_name,
             case c.status when 0 then 'opened' when 1 then 'resolved' else 'closed' end as status,
             c.created_at, c.contact_last_seen_at, c.agent_last_seen_at, c.last_activity_at, c.assignee_last_seen_at, c.first_reply_created_at, c.waiting_since
        from conversations c
        left join contacts c2 on c2.id = c.contact_id
        left join users u on u.id = c.assignee_id
        left join (select user_id, max(team_id) as id from team_members tm2 group by user_id) tm2 on tm2.user_id = u.id
        left join teams t on t.id = tm2.id
        left join inboxes i on c.inbox_id = i.id
        left join (select au.user_id as manager_id, tm.team_id, u.name as manager_name
                     from team_members tm
                     join account_users au on tm.user_id = au.user_id
                     join users u on u.id = au.user_id
                    where au.custom_role_id = 4) m on m.team_id = tm2.id
      where c.created_at between ? and ?;
    `;

    const result = await chatwootDb.raw(query, [startDate, endDate]);
    return result.rows;
  } finally {
    if (chatwootDb) {
      await chatwootDb.destroy();
    }
  }
}

module.exports = { getConversations };
