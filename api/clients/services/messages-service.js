/**
 * Serviço para listar mensagens do Chatwoot
 */
const knex = require('knex');

/**
 * Cria conexão com o banco do Chatwoot usando o prefixo (ex.: "/autonomia/")
 */
async function createChatwootDbConnection(prefix) {
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

  const missing = [];
  if (!host) missing.push(hostVarName);
  if (!name) missing.push(nameVarName);
  if (!password) missing.push(passwordVarName);
  if (!port) missing.push(portVarName);
  if (!user) missing.push(userVarName);
  if (missing.length) throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);

  const chatwootDb = knex({
    client: 'pg',
    connection: { host, port, database: name, user, password },
    pool: { min: 0, max: 2 }
  });
  await chatwootDb.raw('SELECT 1');
  return chatwootDb;
}

/**
 * Lista as últimas mensagens filtradas por account_id, inbox_id e conversation_id
 * Retorna apenas content, created_at e message_type
 */
async function listMessagesByContext(prefix, accountId, inboxId, conversationId, limit = 100) {
  let chatwootDb;
  try {
    chatwootDb = await createChatwootDbConnection(prefix);

    const acc = parseInt(accountId, 10);
    const inbox = parseInt(inboxId, 10);
    const conv = parseInt(conversationId, 10);

    if ([acc, inbox, conv].some((n) => Number.isNaN(n))) {
      throw new Error('Parâmetros inválidos: accountId, inboxId e conversationId devem ser números.');
    }

    const rows = await chatwootDb('messages as m')
      .join('conversations as c', 'c.id', 'm.conversation_id')
      .where('m.account_id', acc)
      .andWhere('m.inbox_id', inbox)
      .andWhere('c.display_id', conv)
      .select(['m.content', 'm.created_at', 'm.message_type'])
      .orderBy('m.created_at', 'desc')
      .limit(limit);

    return rows;
  } finally {
    if (chatwootDb) await chatwootDb.destroy();
  }
}

module.exports = { listMessagesByContext };
