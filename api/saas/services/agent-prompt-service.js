const { getDbConnection } = require("../utils/database");

/**
 * Busca todos os prompts ativos e não deletados de um produto
 * @param {string} productId - ID do produto
 * @param {boolean} includeInactive - Se true, inclui prompts inativos também
 * @returns {Promise<Array>} Lista de prompts
 */
const getPromptsByProductId = async (productId, includeInactive = false) => {
  const knex = getDbConnection();
  const query = knex("agent_prompts").where({
    product_id: productId,
    is_deleted: false,
  });

  if (!includeInactive) {
    query.where({ is_active: true });
  }

  return query.orderBy("code", "asc").orderBy("created_at", "desc");
};

/**
 * Busca histórico completo de prompts (incluindo inativos e deletados)
 * @param {string} productId - ID do produto
 * @returns {Promise<Array>} Lista completa de prompts
 */
const getPromptsHistoryByProductId = async (productId) => {
  const knex = getDbConnection();
  return knex("agent_prompts")
    .where({ product_id: productId })
    .orderBy("code", "asc")
    .orderBy("created_at", "desc");
};

/**
 * Busca um prompt por ID (inclui deletados)
 * @param {string} id - ID do prompt
 * @returns {Promise<Object>} Prompt encontrado
 */
const getPromptById = async (id) => {
  const knex = getDbConnection();
  const prompt = await knex("agent_prompts").where({ id }).first();

  if (!prompt) {
    throw new Error("Prompt não encontrado");
  }

  return prompt;
};

/**
 * Busca o prompt ativo por código e produto
 * @param {string} productId - ID do produto
 * @param {string} code - Código do prompt
 * @returns {Promise<Object|null>} Prompt ativo encontrado ou null
 */
const getActivePromptByCode = async (productId, code) => {
  const knex = getDbConnection();
  const prompt = await knex("agent_prompts")
    .where({
      product_id: productId,
      code,
      is_active: true,
      is_deleted: false,
    })
    .first();

  return prompt;
};

/**
 * Busca um prompt por código e produto (qualquer status)
 * @param {string} productId - ID do produto
 * @param {string} code - Código do prompt
 * @returns {Promise<Object|null>} Prompt encontrado ou null
 */
const getPromptByCode = async (productId, code) => {
  const knex = getDbConnection();
  const prompt = await knex("agent_prompts")
    .where({ product_id: productId, code })
    .first();

  return prompt;
};

/**
 * Cria um novo prompt (e inativa o anterior se existir com o mesmo code)
 * @param {Object} promptData - Dados do prompt
 * @param {string} promptData.product_id - ID do produto
 * @param {string} promptData.title - Título do prompt
 * @param {string} promptData.code - Código/slug do prompt
 * @param {string} promptData.content - Conteúdo do prompt
 * @returns {Promise<Object>} Prompt criado
 */
const createPrompt = async ({ product_id, title, code, content }) => {
  const knex = getDbConnection();

  // Verificar se já existe um prompt ativo com o mesmo código
  const activePrompt = await getActivePromptByCode(product_id, code);

  // Se existe um ativo, inativá-lo antes de criar o novo
  if (activePrompt) {
    await knex("agent_prompts").where({ id: activePrompt.id }).update({
      is_active: false,
      updated_at: knex.fn.now(),
    });
  }

  // Criar o novo prompt como ativo
  const [newPrompt] = await knex("agent_prompts")
    .insert({
      product_id,
      title,
      code,
      content,
      is_active: true,
      is_deleted: false,
    })
    .returning("*");

  return newPrompt;
};

/**
 * Verifica se o conteúdo está vazio
 * @param {string} content - Conteúdo a verificar
 * @returns {boolean} true se estiver vazio
 */
const isContentEmpty = (content) => {
  if (!content) return true;
  if (typeof content !== 'string') return true;
  return content.trim().length === 0;
};

/**
 * Atualiza um prompt existente
 * Se o prompt atual estiver vazio, atualiza diretamente
 * Se tiver conteúdo, cria uma nova versão e inativa a anterior
 * @param {string} id - ID do prompt atual
 * @param {Object} promptData - Dados do prompt a atualizar
 * @param {string} [promptData.title] - Título do prompt
 * @param {string} [promptData.code] - Código/slug do prompt
 * @param {string} [promptData.content] - Conteúdo do prompt
 * @returns {Promise<Object>} Prompt atualizado ou novo prompt criado
 */
const updatePrompt = async (id, { title, code, content }) => {
  const knex = getDbConnection();

  // Verificar se o prompt existe
  const existing = await getPromptById(id);

  if (existing.is_deleted) {
    throw new Error("Não é possível atualizar um prompt deletado");
  }

  // Determinar o código a usar (mantém o atual se não foi fornecido)
  const newCode = code || existing.code;

  // Verificar se já existe outro prompt ativo com o mesmo código (diferente do atual)
  const activePrompt = await getActivePromptByCode(
    existing.product_id,
    newCode
  );
  if (activePrompt && activePrompt.id !== id) {
    // Inativar o outro prompt ativo
    await knex("agent_prompts").where({ id: activePrompt.id }).update({
      is_active: false,
      updated_at: knex.fn.now(),
    });
  }

  // Verificar se o prompt atual está vazio
  const currentContent = content !== undefined ? content : existing.content;
  const isEmpty = isContentEmpty(existing.content);

  // Se o prompt atual está vazio, apenas atualiza diretamente (não cria nova versão)
  if (isEmpty) {
    const updateData = {
      updated_at: knex.fn.now(),
    };

    if (typeof title !== "undefined") {
      updateData.title = title;
    }

    if (typeof code !== "undefined") {
      updateData.code = code;
    }

    if (typeof content !== "undefined") {
      updateData.content = content;
    }

    const [updatedPrompt] = await knex("agent_prompts")
      .where({ id })
      .update(updateData)
      .returning("*");

    return updatedPrompt;
  }

  // Se o prompt atual tem conteúdo, cria nova versão e inativa a anterior
  await knex("agent_prompts").where({ id }).update({
    is_active: false,
    updated_at: knex.fn.now(),
  });

  // Criar novo prompt com os dados atualizados
  const [newPrompt] = await knex("agent_prompts")
    .insert({
      product_id: existing.product_id,
      title: title !== undefined ? title : existing.title,
      code: newCode,
      content: currentContent,
      is_active: true,
      is_deleted: false,
    })
    .returning("*");

  return newPrompt;
};

/**
 * Remove um prompt pelo ID (soft delete)
 * @param {string} id - ID do prompt
 * @param {string} deletedBy - ID do usuário que está deletando
 * @returns {Promise<boolean>} Resultado da operação
 */
const deletePrompt = async (id, deletedBy = null) => {
  const knex = getDbConnection();

  // Verificar se o prompt existe
  const prompt = await getPromptById(id);

  if (prompt.is_deleted) {
    throw new Error("Prompt já está deletado");
  }

  // Soft delete: marcar como deletado e inativar
  await knex("agent_prompts").where({ id }).update({
    is_deleted: true,
    is_active: false,
    deleted_at: knex.fn.now(),
    deleted_by: deletedBy,
    updated_at: knex.fn.now(),
  });

  return true;
};

/**
 * Reativa um prompt deletado ou inativo
 * @param {string} id - ID do prompt a reativar
 * @returns {Promise<Object>} Prompt reativado
 */
const reactivatePrompt = async (id) => {
  const knex = getDbConnection();

  // Verificar se o prompt existe
  const prompt = await getPromptById(id);

  if (!prompt.is_deleted && prompt.is_active) {
    throw new Error("Prompt já está ativo");
  }

  // Verificar se já existe outro prompt ativo com o mesmo código
  const activePrompt = await getActivePromptByCode(
    prompt.product_id,
    prompt.code
  );
  if (activePrompt && activePrompt.id !== id) {
    // Inativar o outro prompt ativo
    await knex("agent_prompts").where({ id: activePrompt.id }).update({
      is_active: false,
      updated_at: knex.fn.now(),
    });
  }

  // Reativar o prompt
  const [reactivatedPrompt] = await knex("agent_prompts")
    .where({ id })
    .update({
      is_active: true,
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      updated_at: knex.fn.now(),
    })
    .returning("*");

  return reactivatedPrompt;
};

module.exports = {
  getPromptsByProductId,
  getPromptsHistoryByProductId,
  getPromptById,
  getPromptByCode,
  getActivePromptByCode,
  createPrompt,
  updatePrompt,
  deletePrompt,
  reactivatePrompt,
};
