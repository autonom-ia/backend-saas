const { getDbConnection } = require("../utils/database");

/**
 * Busca todos os prompts padrão
 * @returns {Promise<Array>} Lista de prompts padrão ordenados
 */
const getAllStandardPrompts = async () => {
  const knex = getDbConnection();
  return knex("agent_prompts_standard")
    .select("*")
    .orderBy("order", "asc")
    .orderBy("code", "asc");
};

/**
 * Busca um prompt padrão por código
 * @param {string} code - Código do prompt
 * @returns {Promise<Object|null>} Prompt padrão encontrado ou null
 */
const getStandardPromptByCode = async (code) => {
  const knex = getDbConnection();
  const prompt = await knex("agent_prompts_standard")
    .where({ code })
    .first();

  return prompt;
};

/**
 * Cria prompts padrão para um produto
 * @param {string} productId - ID do produto
 * @returns {Promise<Array>} Lista de prompts criados
 */
const createStandardPromptsForProduct = async (productId) => {
  const knex = getDbConnection();
  
  // Buscar todos os prompts padrão
  const standardPrompts = await getAllStandardPrompts();
  
  if (standardPrompts.length === 0) {
    console.warn("Nenhum prompt padrão encontrado. Pulando criação automática.");
    return [];
  }
  
  // Criar prompts para o produto baseados nos padrões
  const createdPrompts = [];
  
  for (const standard of standardPrompts) {
    // Verificar se já existe um prompt ativo com este código para o produto
    const existing = await knex("agent_prompts")
      .where({ 
        product_id: productId, 
        code: standard.code, 
        is_active: true, 
        is_deleted: false 
      })
      .first();
    
    // Se não existe, criar
    if (!existing) {
      const [newPrompt] = await knex("agent_prompts")
        .insert({
          product_id: productId,
          title: standard.title,
          code: standard.code,
          content: standard.content,
          is_active: true,
          is_deleted: false,
        })
        .returning("*");
      
      createdPrompts.push(newPrompt);
    }
  }
  
  return createdPrompts;
};

/**
 * Cria um novo prompt padrão
 * @param {Object} promptData - Dados do prompt padrão
 * @returns {Promise<Object>} Prompt padrão criado
 */
const createStandardPrompt = async ({ title, code, content, order = 0 }) => {
  const knex = getDbConnection();
  
  // Verificar se já existe um prompt padrão com este código
  const existing = await getStandardPromptByCode(code);
  if (existing) {
    throw new Error(`Já existe um prompt padrão com o código '${code}'`);
  }
  
  const [newPrompt] = await knex("agent_prompts_standard")
    .insert({
      title,
      code,
      content,
      order,
    })
    .returning("*");
  
  return newPrompt;
};

/**
 * Atualiza um prompt padrão
 * @param {string} id - ID do prompt padrão
 * @param {Object} promptData - Dados a atualizar
 * @returns {Promise<Object>} Prompt padrão atualizado
 */
const updateStandardPrompt = async (id, { title, code, content, order }) => {
  const knex = getDbConnection();
  
  const prompt = await knex("agent_prompts_standard").where({ id }).first();
  if (!prompt) {
    throw new Error("Prompt padrão não encontrado");
  }
  
  // Se o código está sendo alterado, verificar conflito
  if (code && code !== prompt.code) {
    const conflict = await getStandardPromptByCode(code);
    if (conflict) {
      throw new Error(`Já existe um prompt padrão com o código '${code}'`);
    }
  }
  
  const updateData = {
    updated_at: knex.fn.now(),
  };
  
  if (typeof title !== "undefined") updateData.title = title;
  if (typeof code !== "undefined") updateData.code = code;
  if (typeof content !== "undefined") updateData.content = content;
  if (typeof order !== "undefined") updateData.order = order;
  
  const [updatedPrompt] = await knex("agent_prompts_standard")
    .where({ id })
    .update(updateData)
    .returning("*");
  
  return updatedPrompt;
};

/**
 * Remove um prompt padrão
 * @param {string} id - ID do prompt padrão
 * @returns {Promise<boolean>} Resultado da operação
 */
const deleteStandardPrompt = async (id) => {
  const knex = getDbConnection();
  
  const prompt = await knex("agent_prompts_standard").where({ id }).first();
  if (!prompt) {
    throw new Error("Prompt padrão não encontrado");
  }
  
  await knex("agent_prompts_standard").where({ id }).delete();
  
  return true;
};

module.exports = {
  getAllStandardPrompts,
  getStandardPromptByCode,
  createStandardPromptsForProduct,
  createStandardPrompt,
  updateStandardPrompt,
  deleteStandardPrompt,
};

