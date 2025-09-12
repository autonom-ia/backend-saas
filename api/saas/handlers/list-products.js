const { getAllProducts, getProductsForUser } = require('../services/product-service');
const { success, error: errorResponse } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar todos os produtos
 */
exports.handler = withCors(async (event, context) => {
  try {
    const ADMIN_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';

    // Extrair email do usuário autenticado via Cognito Authorizer
    const claims = event?.requestContext?.authorizer?.claims || event?.requestContext?.authorizer?.jwt?.claims || {};
    const email = claims.email || claims['cognito:username'] || null;

    if (!email) {
      return errorResponse({ success: false, message: 'Não autenticado' }, 401, event);
    }

    // Buscar usuário no banco para obter id
    const knex = getDbConnection();
    const user = await knex('users').where({ email }).first();

    if (!user) {
      return errorResponse({ success: false, message: 'Usuário não encontrado' }, 404, event);
    }

    // Verificar perfis de acesso do usuário
    const userProfiles = await knex('user_access_profiles')
      .where({ user_id: user.id })
      .pluck('access_profile_id');
    const isAdmin = Array.isArray(userProfiles) && userProfiles.includes(ADMIN_PROFILE_ID);

    // Admin vê todos os produtos; demais veem apenas os vinculados às suas contas
    const products = isAdmin ? await getAllProducts() : await getProductsForUser(user.id);
    
    return success({
      success: true,
      data: products
    }, 200, event);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    
    return errorResponse({
      success: false,
      message: 'Erro ao buscar produtos',
      error: error.message
    }, 500, event);
  }
});
