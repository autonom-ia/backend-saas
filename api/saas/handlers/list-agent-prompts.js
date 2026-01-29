const {
  getPromptsByProductId,
  getProductTypeInstructionsByProductId,
} = require("../services/agent-prompt-service");
const { success, error: errorResponse } = require("../utils/response");
const { withCors } = require("../utils/cors");

exports.handler = withCors(async (event) => {
  try {
    const productId = event?.queryStringParameters?.productId;
    const includeInactive =
      event?.queryStringParameters?.includeInactive === "true";

    if (!productId) {
      return errorResponse(
        { success: false, message: "Parâmetro productId é obrigatório" },
        400,
        event
      );
    }

    const [agentPrompts, typeInstructions] = await Promise.all([
      getPromptsByProductId(productId, includeInactive),
      getProductTypeInstructionsByProductId(productId)
    ]);

    const editablePrompts = agentPrompts.map((prompt) => ({
      ...prompt,
      isEditable: true,
      source: "agent_prompts",
    }));

    const allItems = [...typeInstructions, ...editablePrompts].sort(
      (a, b) => {
        if (!a.code && !b.code) return 0;
        if (!a.code) return 1;
        if (!b.code) return -1;
        return a.code.localeCompare(b.code);
      }
    );

    return success(
      {
        success: true,
        editablePrompts,
        typeInstructions,
        data: allItems,
      },
      200,
      event
    );
  } catch (error) {
    console.error("Erro ao listar prompts do agente:", error);
    return errorResponse(
      {
        success: false,
        message: "Erro ao listar prompts do agente",
        error: error.message,
      },
      500,
      event
    );
  }
});
