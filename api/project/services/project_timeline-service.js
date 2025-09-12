const { getDbConnection } = require('../utils/database');

async function list({ projectId, productId } = {}) {
  const knex = getDbConnection();
  const q = knex('project_timeline as pt')
    .select(
      'pt.*',
      'p.name as project_name',
      'p.product_id as product_id'
    )
    .leftJoin('project as p', 'p.id', 'pt.project_id')
    // Order by planned dates for proper timeline display
    .orderByRaw('pt.start_date NULLS LAST, pt.due_date NULLS LAST');

  if (projectId) q.where('pt.project_id', projectId);
  if (productId) q.where('p.product_id', productId);

  return await q;
}

async function get(code) {
  const knex = getDbConnection();
  return await knex('project_timeline').where({ code }).first();
}

async function create(payload) {
  const knex = getDbConnection();
  const data = {
    project_id: payload.project_id,
    phase: payload.phase || null,
    task: payload.task || null,
    responsible: payload.responsible || null,
    supporters: payload.supporters || null,
    start_date: payload.start_date || null,
    due_date: payload.due_date || null,
    status: payload.status || null,
    dependencies: payload.dependencies || null,
    acceptance_criteria: payload.acceptance_criteria || null,
    evidence_link: payload.evidence_link || null,
    milestone: payload.milestone ?? null,
    notes: payload.notes || null,
  };
  const [row] = await knex('project_timeline').insert(data).returning('*');
  return row;
}

async function update(code, payload) {
  const knex = getDbConnection();
  const data = {};
  if (payload.project_id !== undefined) data.project_id = payload.project_id;
  if (payload.phase !== undefined) data.phase = payload.phase;
  if (payload.task !== undefined) data.task = payload.task;
  if (payload.responsible !== undefined) data.responsible = payload.responsible;
  if (payload.supporters !== undefined) data.supporters = payload.supporters;
  if (payload.start_date !== undefined) data.start_date = payload.start_date;
  if (payload.due_date !== undefined) data.due_date = payload.due_date;
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.dependencies !== undefined) data.dependencies = payload.dependencies;
  if (payload.acceptance_criteria !== undefined) data.acceptance_criteria = payload.acceptance_criteria;
  if (payload.evidence_link !== undefined) data.evidence_link = payload.evidence_link;
  if (payload.milestone !== undefined) data.milestone = payload.milestone;
  if (payload.notes !== undefined) data.notes = payload.notes;
  data.updated_at = knex.fn.now();

  const [row] = await knex('project_timeline').where({ code }).update(data).returning('*');
  return row;
}

async function remove(code) {
  const knex = getDbConnection();
  return await knex('project_timeline').where({ code }).del();
}

module.exports = { list, get, create, update, remove };
