const knex = require('knex');



async function createChatwootDbConnection(prefix) {
  try {
    const envPrefix = prefix.replace(/^\/|\/$/g, '').split('/')[0].toUpperCase();
    const hostVarName = `${envPrefix}_CHATWOOT_DB_HOST`;
    const nameVarName = `${envPrefix}_CHATWOOT_DB_NAME`;
    const passwordVarName = `${envPrefix}_CHATWOOT_DB_PASSWORD`;
    const portVarName = `${envPrefix}_CHATWOOT_DB_PORT`;
    const userVarName = `${envPrefix}_CHATWOOT_DB_USER`;

    const host = process.env[hostVarName];
    const name = process.env[nameVarName];
    const password = process.env[passwordVarName];
    const port = process.env[portVarName];
    const user = process.env[userVarName];

    const missingEnvVars = [];
    if (!host) missingEnvVars.push(hostVarName);
    if (!name) missingEnvVars.push(nameVarName);
    if (!password) missingEnvVars.push(passwordVarName);
    if (!port) missingEnvVars.push(portVarName);
    if (!user) missingEnvVars.push(userVarName);

    if (missingEnvVars.length > 0) {
      throw new Error(`Faltando variáveis de ambiente: ${missingEnvVars.join(', ')}`);
    }

    const chatwootDb = knex({
      client: 'pg',
      connection: {
        host,
        port,
        database: name,
        user,
        password,
        ssl: false
      },
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
