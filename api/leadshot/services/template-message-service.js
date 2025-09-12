const { getDbConnection } = require('../utils/database');

async function createTemplateMessage({ account_id, name, message_text }) {
  const knex = getDbConnection();
  const [row] = await knex('template_message')
    .insert({ account_id, name, message_text })
    .returning(['id', 'account_id', 'name', 'message_text', 'created_at']);
  return row;
}

async function getTemplateMessage(id) {
  const knex = getDbConnection();
  return knex('template_message').where({ id }).first();
}

async function updateTemplateMessage(id, { name, message_text }) {
  const knex = getDbConnection();
  const payload = {};
  if (typeof name === 'string') payload.name = name;
  if (typeof message_text === 'string') payload.message_text = message_text;
  const [row] = await knex('template_message')
    .where({ id })
    .update(payload)
    .returning(['id', 'account_id', 'name', 'message_text', 'created_at']);
  return row;
}

async function listTemplateMessages(accountId) {
  const knex = getDbConnection();
  return knex('template_message')
    .modify(q => {
      if (accountId) q.where('account_id', accountId);
    })
    .orderBy('created_at', 'desc');
}

module.exports = {
  createTemplateMessage,
  getTemplateMessage,
  updateTemplateMessage,
  listTemplateMessages,
};
