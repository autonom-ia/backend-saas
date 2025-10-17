/**
 * Serviço para listar mensagens do Chatwoot
 */
const knex = require('knex');
const { getDbConnection } = require('../utils/database');

/**
 * Cria conexão com o banco do Chatwoot usando host da tabela account_parameter e credenciais fixas
 */
async function createChatwootDbConnection(prefix) {
  const db = getDbConnection();
  const normalizedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');

  const prefixParam = await db('account_parameter')
    .select('account_id')
    .where({ name: 'prefix-parameter', value: normalizedPrefix })
    .first();
  if (!prefixParam) throw new Error(`Conta não encontrada para o prefixo '${normalizedPrefix}'`);

  const hostParam = await db('account_parameter')
    .select('value')
    .where({ account_id: prefixParam.account_id, name: 'chatwoot_db_host' })
    .first();
  if (!hostParam || !hostParam.value) throw new Error(`Parâmetro 'chatwoot_db_host' não encontrado`);

  const host = hostParam.value;
  const port = 5432;
  const name = 'chatwoot';
  const user = 'postgres';
  const password = 'Mfcd62!!Mfcd62!!';

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
