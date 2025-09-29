/**
 * Serviço para consultar contato por external_code e account_id
 */
const { getDbConnection } = require('../utils/database');

const getContactByExternalCode = async ({ externalCode }) => {
  if (!externalCode) throw new Error('externalCode é obrigatório');

  const db = getDbConnection();
  const contact = await db('contact')
    .where({ external_code: externalCode })
    .first();
  if (!contact) return null;

  const account = await db('account').where({ id: contact.account_id }).first();
  const userSession = await db('user_session')
    .where({ contact_id: contact.id })
    .orderBy('created_at', 'desc')
    .first();
  return { contact, account, user_session: userSession || null };
};

const updateContactByExternalCode = async ({ externalCode, status, finalLink }) => {
  if (!externalCode) throw new Error('externalCode é obrigatório');

  const db = getDbConnection();
  const contact = await db('contact')
    .where({ external_code: externalCode })
    .first();
  if (!contact) return null;

  const currentData = contact.contact_data || {};
  const newData = { ...currentData };
  if (finalLink) {
    newData.finalLink = finalLink;
  }

  const payload = {
    updated_at: new Date(),
    contact_data: newData,
  };
  if (typeof status === 'string' && status.length > 0) {
    payload.external_status = status;
  }

  const [updated] = await db('contact')
    .where({ id: contact.id })
    .update(payload)
    .returning('*');

  const account = await db('account').where({ id: updated.account_id }).first();
  const userSession = await db('user_session')
    .where({ contact_id: updated.id })
    .orderBy('created_at', 'desc')
    .first();
  return { contact: updated, account, user_session: userSession || null };
};

module.exports = { getContactByExternalCode, updateContactByExternalCode };
