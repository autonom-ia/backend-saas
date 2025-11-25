const { success, error: errorResponse } = require("../utils/response");
const { withCors } = require("../utils/cors");
const { getDbConnection } = require("../utils/database");
const { deletePrompt } = require("../services/agent-prompt-service");

/**
 * Handler para remover um prompt do agente (soft delete)
 */
exports.handler = withCors(async (event) => {
  try {
    const { promptId } = event.pathParameters || {};

    if (!promptId) {
      return errorResponse(
        {
          success: false,
          message: "ID do prompt é obrigatório",
        },
        400,
        event
      );
    }

    // Extrair email do usuário autenticado via Cognito Authorizer
    const claims =
      event?.requestContext?.authorizer?.claims ||
      event?.requestContext?.authorizer?.jwt?.claims ||
      {};
    const email = claims.email || claims["cognito:username"] || null;

    let deletedBy = null;
    if (email) {
      // Buscar usuário no banco para obter id
      const knex = getDbConnection();
      const user = await knex("users").where({ email }).first();
      if (user) {
        deletedBy = user.id;
      }
    }

    await deletePrompt(promptId, deletedBy);

    return success(
      {
        success: true,
        message: "Prompt removido com sucesso",
      },
      200,
      event
    );
  } catch (error) {
    console.error(`Erro ao remover prompt: ${error.message}`);

    if (
      error.message === "Prompt não encontrado" ||
      error.message === "Prompt já está deletado"
    ) {
      return errorResponse(
        {
          success: false,
          message: error.message,
        },
        404,
        event
      );
    }

    return errorResponse(
      {
        success: false,
        message: "Erro ao remover prompt",
        error: error.message,
      },
      500,
      event
    );
  }
});
