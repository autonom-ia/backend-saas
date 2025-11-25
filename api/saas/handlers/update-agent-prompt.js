const { updatePrompt } = require("../services/agent-prompt-service");
const { success, error: errorResponse } = require("../utils/response");
const { withCors } = require("../utils/cors");

/**
 * Handler para atualizar um prompt do agente
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

    const { title, code, content } = requestBody;

    // Validar se pelo menos um campo foi fornecido para atualização
    if (
      typeof title === "undefined" &&
      typeof code === "undefined" &&
      typeof content === "undefined"
    ) {
      return errorResponse(
        {
          success: false,
          message: "Pelo menos um campo deve ser fornecido para atualização",
        },
        400,
        event
      );
    }

    const updatedPrompt = await updatePrompt(promptId, {
      title,
      code,
      content,
    });

    return success(
      {
        success: true,
        message: "Prompt atualizado com sucesso",
        data: updatedPrompt,
      },
      200,
      event
    );
  } catch (error) {
    console.error(`Erro ao atualizar prompt: ${error.message}`);

    if (error.message === "Prompt não encontrado") {
      return errorResponse(
        {
          success: false,
          message: error.message,
        },
        404,
        event
      );
    }

    if (error.message.includes("Já existe um prompt com o código")) {
      return errorResponse(
        {
          success: false,
          message: error.message,
        },
        409,
        event
      );
    }

    return errorResponse(
      {
        success: false,
        message: "Erro ao atualizar prompt",
        error: error.message,
      },
      500,
      event
    );
  }
});
