const { getDbConnection } = require('../utils/database');

async function list({ productId } = {}) {
  const knex = getDbConnection();
  const query = knex('project').select('*');
  if (productId) query.where({ product_id: productId });
  return await query.orderBy('created_at', 'desc');
}

// Lista projetos associados às contas do usuário (via account.product_id)
async function listForUser(userId, { productId } = {}) {
  const knex = getDbConnection();
  const q = knex('project as p')
    .distinct('p.*')
    .join('account as a', 'a.product_id', 'p.product_id')
    .join('user_accounts as ua', 'ua.account_id', 'a.id')
    .where('ua.user_id', userId)
    .orderBy('p.created_at', 'desc');
  if (productId) q.andWhere('a.product_id', productId);
  return await q;
}

async function get(projectId) {
  const knex = getDbConnection();
  return await knex('project').where({ id: projectId }).first();
}

async function create(payload) {
  const knex = getDbConnection();
  const data = {
    name: payload.name,
    description: payload.description || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    product_id: payload.product_id,
  };
  const [row] = await knex('project').insert(data).returning('*');
  return row;
}

async function update(projectId, payload) {
  const knex = getDbConnection();
  const data = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.start_date !== undefined) data.start_date = payload.start_date;
  if (payload.end_date !== undefined) data.end_date = payload.end_date;
  if (payload.product_id !== undefined) data.product_id = payload.product_id;
  data.updated_at = knex.fn.now();

  const [row] = await knex('project').where({ id: projectId }).update(data).returning('*');
  return row;
}

async function remove(projectId) {
  const knex = getDbConnection();
  return await knex('project').where({ id: projectId }).del();
}

module.exports = { list, listForUser, get, create, update, remove };
