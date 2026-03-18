const { getDbConnection } = require('../utils/database');

// Lista steps filtrando por accountId (via account.conversation_funnel_id)
const getAllStepsByAccountId = async (accountId) => {
  const knex = getDbConnection();
  return knex('conversation_funnel_step as s')
    .join('account as a', 'a.conversation_funnel_id', 's.conversation_funnel_id')
    .where('a.id', accountId)
    .select('s.*')
    .orderBy('s.order', 'asc')
    .orderBy('s.created_at', 'desc');
};

// Busca step por ID
const getStepById = async (id) => {
  const knex = getDbConnection();
  const item = await knex('conversation_funnel_step').where({ id }).first();
  if (!item) throw new Error('Etapa de funil não encontrada');
  return item;
};

// Cria step
const createStep = async ({
  name,
  description,
  conversation_funnel_id,
  agent_instruction,
  order,
  kanban_code,
  assign_to_team,
  chatwoot_team_id,
  visible_in_sales_funnel,
}) => {
  const knex = getDbConnection();
  if (!name || !description || !conversation_funnel_id) {
    throw new Error('Campos obrigatórios: name, description, conversation_funnel_id');
  }
  const insertData = { name, description, conversation_funnel_id };
  if (agent_instruction !== undefined) insertData.agent_instruction = agent_instruction;
  if (order !== undefined) insertData.order = order;
  if (kanban_code !== undefined) insertData.kanban_code = kanban_code;
  if (assign_to_team !== undefined) insertData.assign_to_team = assign_to_team;
  if (chatwoot_team_id !== undefined) insertData.chatwoot_team_id = chatwoot_team_id;
  if (visible_in_sales_funnel !== undefined) insertData.visible_in_sales_funnel = visible_in_sales_funnel;
  const [created] = await knex('conversation_funnel_step')
    .insert(insertData)
    .returning('*');
  return created;
};

// Atualiza step
const updateStep = async (
  id,
  {
    name,
    description,
    conversation_funnel_id,
    agent_instruction,
    order,
    kanban_code,
    assign_to_team,
    chatwoot_team_id,
    visible_in_sales_funnel,
  }
) => {
  const knex = getDbConnection();
  await getStepById(id);
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (conversation_funnel_id !== undefined) updateData.conversation_funnel_id = conversation_funnel_id;
  if (agent_instruction !== undefined) updateData.agent_instruction = agent_instruction;
  if (order !== undefined) updateData.order = order;
  if (kanban_code !== undefined) updateData.kanban_code = kanban_code;
  if (assign_to_team !== undefined) updateData.assign_to_team = assign_to_team;
  if (chatwoot_team_id !== undefined) updateData.chatwoot_team_id = chatwoot_team_id;
  if (visible_in_sales_funnel !== undefined) updateData.visible_in_sales_funnel = visible_in_sales_funnel;
  const [updated] = await knex('conversation_funnel_step')
    .where({ id })
    .update(updateData)
    .returning('*');
  return updated;
};

// Remove step
const deleteStep = async (id) => {
  const knex = getDbConnection();
  await knex.transaction(async (trx) => {
    const step = await trx('conversation_funnel_step').where({ id }).first();

    if (!step) {
      throw new Error('Etapa de funil não encontrada');
    }

    await trx('kanban_items')
      .where({ funnel_stage_id: id })
      .delete();

    await trx('conversation_funnel_step').where({ id }).delete();
  });

  return true;
};

module.exports = {
  getAllStepsByAccountId,
  getStepById,
  createStep,
  updateStep,
  deleteStep,
};
