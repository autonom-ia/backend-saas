/**
 * Serviço SAAS para operações em kanban_items
 * (cópia adaptada do módulo funnel, utilizando utilitários do SAAS)
 */
const { getDbConnection } = require('../utils/database');
const { sendContactWebhookForKanbanItem } = require('../utils/webhook');

// Campos permitidos para criação/atualização (mantido para futura expansão)
const updatableFields = [
  'account_id',
  'funnel_id',
  'funnel_stage_id',
  'user_session_id',
  'position',
  'summary',
  'title',
  'timer_started_at',
  'timer_duration'
];

/**
 * Lista itens do kanban com joins para trazer nomes relacionados
 * @param {{ accountId?: string, funnelStageId?: string, limit?: number, offset?: number }} params
 */
const listKanbanItems = async (params = {}) => {
  const { accountId, funnelStageId, limit = 100, offset = 0 } = params;
  const db = await getDbConnection();

  const query = db('kanban_items as ki')
    .leftJoin('account as a', 'a.id', 'ki.account_id')
    .leftJoin('conversation_funnel as f', 'f.id', 'ki.funnel_id')
    .leftJoin('conversation_funnel_step as s', 's.id', 'ki.funnel_stage_id')
    .leftJoin('user_session as us', 'us.id', 'ki.user_session_id')
    .leftJoin('conversation_funnel_register as cfr', 'cfr.id', 'ki.conversation_funnel_register_id')
    .modify((qb) => {
      if (accountId) qb.where('ki.account_id', accountId);
      if (funnelStageId) qb.where('ki.funnel_stage_id', funnelStageId);
    })
    .select(
      'ki.*',
      db.raw('a.name as account_name'),
      db.raw('f.name as funnel_name'),
      db.raw('s.name as funnel_stage_name'),
      db.raw('s.kanban_code as funnel_stage_kanban_code'),
      db.raw('s.order as funnel_stage_order'),
      db.raw('us.id as user_session_id'),
      db.raw('us.name as user_session_name'),
      db.raw('us.phone as user_session_phone'),
      db.raw('us.inbox_id as user_session_inbox_id'),
      db.raw('us.conversation_id as user_session_conversation_id'),
      db.raw('us.created_at as user_session_created_at'),
      db.raw('cfr.id as cfr_id'),
      db.raw('cfr.summary as cfr_summary'),
      db.raw('cfr.conversation_funnel_step_id as cfr_conversation_funnel_step_id'),
      db.raw('cfr.last_timestamptz as cfr_last_timestamptz'),
      db.raw('cfr.created_at as cfr_created_at')
    )
    .orderBy([
      { column: 'ki.updated_at', order: 'desc' },
      { column: 'ki.created_at', order: 'desc' }
    ])
    .limit(limit)
    .offset(offset);

  return query;
};

/**
 * Atualiza um item do kanban
 * @param {string} id - ID do item
 * @param {object} data - Dados para atualizar
 */
const updateKanbanItem = async (id, data) => {
  const db = await getDbConnection();
  console.log('[SAAS KanbanItems] Iniciando updateKanbanItem', {
    id,
    dataKeys: Object.keys(data || {}),
  });

  const payload = {};
  for (const field of updatableFields) {
    if (field in data) {
      payload[field] = data[field];
    }
  }
  
  // Sempre atualizar updated_at
  payload.updated_at = db.fn.now();
  console.log('[SAAS KanbanItems] Payload de updateKanbanItem montado', {
    id,
    payloadKeys: Object.keys(payload),
  });

  const result = await db('kanban_items')
    .where({ id })
    .update(payload)
    .returning('*');

  const updated = result[0];
  console.log('[SAAS KanbanItems] kanban_item atualizado, preparando envio de webhook', {
    id,
    kanbanItemId: updated && updated.id,
    user_session_id: updated && updated.user_session_id,
  });

  try {
    const startedAt = Date.now();
    await sendContactWebhookForKanbanItem(db, updated);
    console.log('[SAAS KanbanItems] Webhook de contato enviado (ou ignorado) com sucesso', {
      id,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[SAAS KanbanItems] Erro ao enviar webhook de contato para kanban_item', {
      id,
      errorMessage: err && err.message,
      errorName: err && err.name,
      errorStack: err && err.stack,
    });
  }

  return updated;
};

module.exports = {
  listKanbanItems,
  updateKanbanItem,
};
