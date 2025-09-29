/**
 * Serviço para CRUD de contatos
 */
const { getDbConnection } = require('../utils/database');

/**
 * Lista contatos filtrando por conta e com filtro opcional por telefone
 * @param {Object} params
 * @param {string} params.accountId - ID da conta (obrigatório)
 * @param {string} [params.phone]
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 */
const listContacts = async ({ accountId, phone, limit, offset } = {}) => {
  if (!accountId) {
    throw new Error('accountId é obrigatório');
  }
  const db = getDbConnection();
  const query = db('contact')
    .select('*')
    .where('account_id', accountId)
    .orderBy('created_at', 'desc');

  if (phone) {
    query.where('phone', phone);
  }

  if (typeof limit === 'number' && limit > 0) {
    query.limit(limit);
  }
  if (typeof offset === 'number' && offset >= 0) {
    query.offset(offset);
  }

  return await query;
};

/**
 * Cria um contato
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.account_id
 * @param {string} [data.phone]
 * @param {Object} [data.contact_data]
 * @param {string} [data.campaign_id]
 */
const createContact = async (data) => {
  if (!data || !data.name) {
    throw new Error('Nome é obrigatório para criar contato');
  }
  if (!data.account_id) {
    throw new Error('account_id é obrigatório para criar contato');
  }

  const db = getDbConnection();

  const payload = {
    name: data.name,
    phone: data.phone || null,
    contact_data: data.contact_data || {},
    campaign_id: data.campaign_id || null,
    account_id: data.account_id,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const [created] = await db('contact').insert(payload).returning('*');
  return created;
};

/**
 * Atualiza parcialmente um contato por ID
 * @param {string} id
 * @param {Object} data
 */
const updateContact = async (id, data) => {
  if (!id) {
    throw new Error('ID é obrigatório para atualizar contato');
  }
  if (!data || Object.keys(data).length === 0) {
    throw new Error('Nenhum dado fornecido para atualização');
  }

  const db = getDbConnection();
  const payload = { ...data, updated_at: new Date() };
  // Não permitir alteração de account_id via update
  if ('account_id' in payload) {
    delete payload.account_id;
  }

  const [updated] = await db('contact').where({ id }).update(payload).returning('*');
  return updated || null;
};

module.exports = {
  listContacts,
  createContact,
  updateContact,
};
