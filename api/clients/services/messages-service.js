/**
 * Serviço para listar mensagens do Chatwoot
 */
const { getDbConnection } = require('../utils/database');
const {
  createChatwootDbConnection: createConfiguredChatwootDbConnection,
  getAccountIdByPrefix,
} = require('../utils/chatwoot-database');

/**
 * Cria conexão com o banco do Chatwoot usando a configuração da conta mapeada pelo prefixo.
 */
async function createChatwootDbConnection(prefix) {
  const db = getDbConnection();
  const accountId = await getAccountIdByPrefix(db, prefix);

  return createConfiguredChatwootDbConnection(db, {
    accountId,
  });
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
