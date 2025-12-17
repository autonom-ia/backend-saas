const { updateProduct } = require("../services/product-service");
const { success, error: errorResponse } = require("../utils/response");
const { withCors } = require("../utils/cors");

/**
 * Handler para atualizar um produto existente
 */
exports.handler = withCors(async (event, context) => {
  try {
    const { productId } = event.pathParameters || {};

    if (!productId) {
      return errorResponse(
        {
          success: false,
          message: "ID do produto é obrigatório",
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

    const { name, description, product_type_id, conversation_funnel_id } = requestBody;

    // Validar se pelo menos um campo foi fornecido para atualização
    if (
      typeof name === "undefined" &&
      typeof description === "undefined" &&
      typeof product_type_id === "undefined"
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

    const updatedProduct = await updateProduct(productId, {
      name,
      description,
      product_type_id,
      conversation_funnel_id,
    });

    return success(
      {
        success: true,
        message: "Produto atualizado com sucesso",
        data: updatedProduct,
      },
      200,
      event
    );
  } catch (error) {
    console.error(`Erro ao atualizar produto: ${error.message}`);

    if (error.message === "Produto não encontrado") {
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
        message: "Erro ao atualizar produto",
        error: error.message,
      },
      500,
      event
    );
  }
});
