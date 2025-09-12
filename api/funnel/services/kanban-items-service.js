/**
 * Serviço para operações em kanban_items
 */
const { getDbConnection } = require('../utils/database');

// Campos permitidos para criação/atualização
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
    .modify((qb) => {
      if (accountId) qb.where('ki.account_id', accountId);
    })
    .select(
      'ki.*',
      db.raw('a.name as account_name'),
      db.raw('f.name as funnel_name'),
      db.raw('s.name as funnel_stage_name'),
      db.raw('us.name as user_session_name')
    )
    .orderBy([{ column: 'ki.position', order: 'asc' }, { column: 'ki.created_at', order: 'asc' }])
    .limit(limit)
    .offset(offset);

  return query;
};

/**
 * Busca um item por ID (com joins para nomes)
 */
const getKanbanItem = async (id) => {
  const db = await getDbConnection();
  const item = await db('kanban_items as ki')
    .leftJoin('account as a', 'a.id', 'ki.account_id')
    .leftJoin('conversation_funnel as f', 'f.id', 'ki.funnel_id')
    .leftJoin('conversation_funnel_step as s', 's.id', 'ki.funnel_stage_id')
    .leftJoin('user_session as us', 'us.id', 'ki.user_session_id')
    .where('ki.id', id)
    .select(
      'ki.*',
      db.raw('a.name as account_name'),
      db.raw('f.name as funnel_name'),
      db.raw('s.name as funnel_stage_name'),
      db.raw('us.name as user_session_name')
    )
    .first();

  return item;
};

/**
 * Cria um novo item de kanban
 */
const createKanbanItem = async (data) => {
  const db = await getDbConnection();
  const insertData = {};
  for (const key of updatableFields) {
    if (data[key] !== undefined) insertData[key] = data[key];
  }
  insertData.created_at = db.fn.now();
  insertData.updated_at = db.fn.now();

  const [created] = await db('kanban_items').insert(insertData).returning('*');
  return created;
};

/**
 * Atualiza um item de kanban
 */
const updateKanbanItem = async (id, data) => {
  const db = await getDbConnection();
  const updateData = {};
  for (const key of updatableFields) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }
  updateData.updated_at = db.fn.now();

  const [updated] = await db('kanban_items')
    .where('id', id)
    .update(updateData)
    .returning('*');
  return updated;
};

/**
 * Remove um item de kanban
 */
const deleteKanbanItem = async (id) => {
  const db = await getDbConnection();
  await db('kanban_items').where('id', id).del();
  return { id };
};

module.exports = {
  listKanbanItems,
  getKanbanItem,
  createKanbanItem,
  updateKanbanItem,
  deleteKanbanItem,
};
