const { getDbConnection } = require('../utils/database');

// Lista messages filtrando por accountId (via account.conversation_funnel_id -> steps -> messages)
const getAllMessagesByAccountId = async (accountId) => {
  const knex = getDbConnection();
  return knex('conversation_funnel_step_message as m')
    .join('conversation_funnel_step as s', 's.id', 'm.conversation_funnel_step_id')
    .join('account as a', 'a.conversation_funnel_id', 's.conversation_funnel_id')
    .where('a.id', accountId)
    .select('m.*')
    .orderBy('m.created_at', 'desc');
};

// Busca message por ID
const getMessageById = async (id) => {
  const knex = getDbConnection();
  const item = await knex('conversation_funnel_step_message').where({ id }).first();
  if (!item) throw new Error('Mensagem de etapa não encontrada');
  return item;
};

// Cria message
const createMessage = async ({ name, description, conversation_funnel_step_id, shipping_time, shipping_order, message_instruction, fixed_message }) => {
  const knex = getDbConnection();
  if (!name || !description || !conversation_funnel_step_id) {
    throw new Error('Campos obrigatórios: name, description, conversation_funnel_step_id');
  }
  const payload = {
    name,
    description,
    conversation_funnel_step_id,
    shipping_time: shipping_time ?? null,
    shipping_order: shipping_order ?? null,
    message_instruction: message_instruction ?? null,
    fixed_message: fixed_message ?? null,
  };
  const [created] = await knex('conversation_funnel_step_message')
    .insert(payload)
    .returning('*');
  return created;
};

// Atualiza message
const updateMessage = async (id, { name, description, conversation_funnel_step_id, shipping_time, shipping_order, message_instruction, fixed_message }) => {
  const knex = getDbConnection();
  await getMessageById(id);
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (conversation_funnel_step_id !== undefined) updateData.conversation_funnel_step_id = conversation_funnel_step_id;
  if (shipping_time !== undefined) updateData.shipping_time = shipping_time;
  if (shipping_order !== undefined) updateData.shipping_order = shipping_order;
  if (message_instruction !== undefined) updateData.message_instruction = message_instruction;
  if (fixed_message !== undefined) updateData.fixed_message = fixed_message;
  const [updated] = await knex('conversation_funnel_step_message')
    .where({ id })
    .update(updateData)
    .returning('*');
  return updated;
};

// Remove message
const deleteMessage = async (id) => {
  const knex = getDbConnection();
  await getMessageById(id);
  await knex('conversation_funnel_step_message').where({ id }).delete();
  return true;
};

module.exports = {
  getAllMessagesByAccountId,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
};
