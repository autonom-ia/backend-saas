const { getDbConnection } = require('../utils/database');

// Lista funis. Quando defaultOnly=true, retorna apenas os funis padrão
// e, se fornecido accountId, inclui também o funil vinculado à conta.
const getAllFunnels = async ({ defaultOnly = false, accountId } = {}) => {
  const knex = getDbConnection();

  if (!defaultOnly) {
    return knex('conversation_funnel')
      .select('*')
      .orderBy('created_at', 'desc');
  }

  // Busca apenas funis padrão
  const defaults = await knex('conversation_funnel')
    .select('*')
    .where({ is_default: true })
    .orderBy('created_at', 'desc');

  // Se não houver accountId, retorna só os padrão
  if (!accountId) return defaults;

  // Busca o funil vinculado à conta (se houver)
  const account = await knex('account')
    .select('conversation_funnel_id')
    .where({ id: accountId })
    .first();

  if (!account || !account.conversation_funnel_id) return defaults;

  const accountFunnel = await knex('conversation_funnel')
    .select('*')
    .where({ id: account.conversation_funnel_id })
    .first();

  // Mescla garantindo unicidade por id
  const merged = [...defaults];
  if (accountFunnel && !merged.find((f) => f.id === accountFunnel.id)) {
    merged.push(accountFunnel);
  }
  return merged;
};

// Busca funil por ID
const getFunnelById = async (id) => {
  const knex = getDbConnection();
  const item = await knex('conversation_funnel').where({ id }).first();
  if (!item) throw new Error('Funil não encontrado');
  return item;
};

// Cria funil
const createFunnel = async ({ name, description, is_default = false }) => {
  const knex = getDbConnection();
  if (!name || !description) {
    throw new Error('Campos obrigatórios: name, description');
  }
  const [created] = await knex('conversation_funnel')
    .insert({ name, description, is_default })
    .returning('*');
  return created;
};

// Atualiza funil
const updateFunnel = async (id, { name, description, is_default }) => {
  const knex = getDbConnection();
  await getFunnelById(id);
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (is_default !== undefined) updateData.is_default = is_default;
  const [updated] = await knex('conversation_funnel')
    .where({ id })
    .update(updateData)
    .returning('*');
  return updated;
};

// Remove funil
const deleteFunnel = async (id) => {
  const knex = getDbConnection();
  await getFunnelById(id);
  await knex('conversation_funnel').where({ id }).delete();
  return true;
};

module.exports = {
  getAllFunnels,
  getFunnelById,
  createFunnel,
  updateFunnel,
  deleteFunnel,
};

