const {
  getAllProducts,
  getProductsForUser,
  getProductsByDomain,
} = require("../services/product-service");
const { success, error: errorResponse } = require("../utils/response");
const { withCors } = require("../utils/cors");
const { getAdminProfile } = require("../services/access-profile-service");
const { getUserFromEvent } = require("../utils/auth-user");
const {
  getUserPermissions,
  hasDomainAccess,
} = require("../services/user-company-service");

/**
 * Handler para listar todos os produtos
 */
exports.handler = withCors(async (event, context) => {
  try {
    const adminProfile = (await getAdminProfile()) || {};

    const resolved = await getUserFromEvent(event);
    if (!resolved) {
      return errorResponse(
        { success: false, message: "Não autenticado" },
        401,
        event
      );
    }

    const { user } = resolved;

    // Verificar perfis de acesso do usuário
    const { getDbConnection } = require("../utils/database");
    const knex = getDbConnection();
    const userProfiles = await knex("user_access_profiles")
      .where({ user_id: user.id })
      .pluck("access_profile_id");
    const isAdmin =
      Array.isArray(userProfiles) && userProfiles.includes(adminProfile.id);

    const queryParams = event.queryStringParameters || {};
    const domain = queryParams.domain;

    let products;

    if (domain) {
      const { canSeeAll } = await getUserPermissions(user.id);
      const hasAccess = await hasDomainAccess(knex, user.id, domain, canSeeAll);

      if (!hasAccess) {
        return errorResponse(
          { success: false, message: "Acesso negado para este domínio" },
          403,
          event
        );
      }

      products = await getProductsByDomain(domain);
    } else {
      // Comportamento legado: Admin vê todos os produtos; demais veem apenas os vinculados às suas contas
      products = isAdmin
        ? await getAllProducts()
        : await getProductsForUser(user.id);
    }

    return success(
      {
        success: true,
        data: products,
      },
      200,
      event
    );
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);

    return errorResponse(
      {
        success: false,
        message: "Erro ao buscar produtos",
        error: error.message,
      },
      500,
      event
    );
  }
});
