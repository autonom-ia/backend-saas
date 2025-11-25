const { createProduct } = require("../services/product-service");
const { getDbConnection } = require("../utils/database");
const { success, error: errorResponse } = require("../utils/response");
const { withCors } = require("../utils/cors");

/**
 * Handler para criar um novo produto
 * Automaticamente cria prompts padrão e parâmetros padrão
 */
exports.handler = withCors(async (event, context) => {
  try {
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return errorResponse(
        {
          success: false,
          message: "Corpo da requisição inválido",
        },
        400,
        event
      );
    }

    const { name, description, product_type_id } = requestBody;

    // Validação dos campos obrigatórios
    if (!name) {
      return errorResponse(
        {
          success: false,
          message: "Nome do produto é obrigatório",
        },
        400,
        event
      );
    }

    // description opcional

    const newProduct = await createProduct({
      name,
      description,
      product_type_id,
    });

    // Criar parâmetros para o novo produto baseado nos padrões (product_parameters_standard)
    try {
      const knex = getDbConnection();
      const standardParams = await knex("product_parameters_standard")
        .select("name", "short_description", "help_text", "default_value")
        .orderBy("name", "asc");

      if (standardParams.length > 0) {
        const seedRows = standardParams.map((param) => ({
          name: param.name,
          value: param.default_value || "",
          product_id: newProduct.id,
          short_description: param.short_description,
          help_text: param.help_text,
          default_value: param.default_value,
        }));
        await knex("product_parameter").insert(seedRows);
      }
    } catch (seedErr) {
      console.error(
        "[create-product] Falha ao semear product_parameter para o novo produto:",
        seedErr?.message || seedErr
      );
      // Não interrompe a criação do produto
    }

    // Criar prompts padrão para o novo produto baseado nos padrões (agent_prompts_standard)
    try {
      const knex = getDbConnection();
      const standardPrompts = await knex("agent_prompts_standard")
        .select("title", "code", "content")
        .orderBy("order", "asc");

      if (standardPrompts.length > 0) {
        const promptRows = standardPrompts.map((prompt) => ({
          product_id: newProduct.id,
          title: prompt.title,
          code: prompt.code,
          content: prompt.content,
          is_active: true,
          is_deleted: false,
        }));
        await knex("agent_prompts").insert(promptRows);
      }
    } catch (promptErr) {
      console.error(
        "[create-product] Falha ao semear agent_prompts para o novo produto:",
        promptErr?.message || promptErr
      );
      // Não interrompe a criação do produto
    }

    return success(
      {
        success: true,
        message: "Produto criado com sucesso",
        data: newProduct,
      },
      201,
      event
    );
  } catch (error) {
    console.error(`Erro ao criar produto: ${error.message}`);

    return errorResponse(
      {
        success: false,
        message: "Erro ao criar produto",
        error: error.message,
      },
      500,
      event
    );
  }
});
