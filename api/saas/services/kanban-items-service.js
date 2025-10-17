/**
 * Serviço SAAS para operações em kanban_items
 * (cópia adaptada do módulo funnel, utilizando utilitários do SAAS)
 */
const { getDbConnection } = require('../utils/database');

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
 * @param {{ accountId?: string, limit?: number, offset?: number }} params
 */
const listKanbanItems = async (params = {}) => {
  const { accountId, limit = 100, offset = 0 } = params;
  const db = await getDbConnection();

  const query = db('kanban_items as ki')
    .leftJoin('account as a', 'a.id', 'ki.account_id')
    .leftJoin('conversation_funnel as f', 'f.id', 'ki.funnel_id')
    .leftJoin('conversation_funnel_step as s', 's.id', 'ki.funnel_stage_id')
    .leftJoin('user_session as us', 'us.id', 'ki.user_session_id')
    .leftJoin('conversation_funnel_register as cfr', 'cfr.id', 'ki.conversation_funnel_register_id')
    .modify((qb) => {
      if (accountId) qb.where('ki.account_id', accountId);
    })
    .select(
      'ki.*',
      db.raw('a.name as account_name'),
      db.raw('f.name as funnel_name'),
      db.raw('s.name as funnel_stage_name'),
      db.raw('s.kanban_code as funnel_stage_kanban_code'),
      db.raw('us.name as user_session_name'),
      db.raw('cfr.id as cfr_id'),
      db.raw('cfr.summary as cfr_summary'),
      db.raw('cfr.conversation_funnel_step_id as cfr_conversation_funnel_step_id'),
      db.raw('cfr.last_timestamptz as cfr_last_timestamptz'),
      db.raw('cfr.created_at as cfr_created_at')
    )
    .orderBy([{ column: 'ki.position', order: 'asc' }, { column: 'ki.created_at', order: 'asc' }])
    .limit(limit)
    .offset(offset);

  return query;
};

module.exports = {
  listKanbanItems,
};
