/**
 * Knowledge Document service (SAAS)
 */
const { getDbConnection } = require('../utils/database');

/**
 * List documents with optional filters
 * @param {Object} params
 * @param {string=} params.accountId
 */
async function listKnowledgeDocuments(params = {}) {
  const knex = getDbConnection();
  const q = knex('knowledge_document as kd')
    .leftJoin('account as a', 'a.id', 'kd.account_id')
    .select(
      'kd.id',
      'kd.filename',
      'kd.category',
      'kd.category_id',
      'kd.document_types',
      'kd.file_extension',
      'kd.document_url',
      'kd.account_id',
      'kd.created_at',
      'kd.updated_at',
      knex.raw('a.name as account_name')
    )
    .orderBy('kd.created_at', 'desc');

  if (params.accountId) {
    q.where('kd.account_id', params.accountId);
  }

  return q;
}

/**
 * Get one document by id
 */
async function getKnowledgeDocument(id) {
  const knex = getDbConnection();
  const row = await knex('knowledge_document as kd')
    .leftJoin('account as a', 'a.id', 'kd.account_id')
    .where('kd.id', id)
    .first(
      'kd.id',
      'kd.filename',
      'kd.category',
      'kd.category_id',
      'kd.document_types',
      'kd.file_extension',
      'kd.document_url',
      'kd.account_id',
      'kd.created_at',
      'kd.updated_at',
      knex.raw('a.name as account_name')
    );
  return row || null;
}

/**
 * Create a document
 */
async function createKnowledgeDocument(payload) {
  const knex = getDbConnection();
  const data = {
    id: knex.raw('gen_random_uuid()'),
    filename: payload.filename,
    category: payload.category || null,
    category_id: payload.category_id || null,
    document_types: payload.document_types ?? null,
    file_extension: payload.file_extension || null,
    document_url: payload.document_url || null,
    account_id: payload.account_id,
  };

  if (!data.filename) {
    throw new Error('filename é obrigatório');
  }
  if (!data.account_id) {
    throw new Error('account_id é obrigatório');
  }

  const [created] = await knex('knowledge_document')
    .insert(data)
    .returning('*');
  return created;
}

/**
 * Update a document
 */
async function updateKnowledgeDocument(id, payload) {
  const knex = getDbConnection();
  const patch = {};
  if (payload.filename !== undefined) patch.filename = payload.filename;
  if (payload.category !== undefined) patch.category = payload.category;
  if (payload.category_id !== undefined) patch.category_id = payload.category_id;
  if (payload.document_types !== undefined) patch.document_types = payload.document_types;
  if (payload.file_extension !== undefined) patch.file_extension = payload.file_extension;
  if (payload.document_url !== undefined) patch.document_url = payload.document_url;
  if (payload.account_id !== undefined) patch.account_id = payload.account_id;
  patch.updated_at = knex.fn.now();

  const [updated] = await knex('knowledge_document')
    .where({ id })
    .update(patch)
    .returning('*');
  return updated || null;
}

/**
 * Delete a document
 */
async function deleteKnowledgeDocument(id) {
  const knex = getDbConnection();
  await knex('knowledge_document').where({ id }).del();
  return { success: true };
}

module.exports = {
  listKnowledgeDocuments,
  getKnowledgeDocument,
  createKnowledgeDocument,
  updateKnowledgeDocument,
  deleteKnowledgeDocument,
};
