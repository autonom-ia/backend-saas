// api/saas/handlers/list-products.js
const { getAllProducts, getProductsForUser } = require('../services/product-service');
const { success, error: errorResponse } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const { withCors } = require('../utils/cors');

const ADMIN_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';
const DEV_DEFAULT_EMAIL = 'adfelipevs@gmail.com';

/**
 * Lista produtos considerando privilégios do usuário.
 * - Em produção: exige Cognito (claims no requestContext)
 * - Em desenvolvimento (serverless-offline): aceita header X-Dev-Email ou usa DEV_DEFAULT_EMAIL
 */
exports.handler = withCors(async (event) => {
  try {
    const headers = event && event.headers ? event.headers : {};
    const claims = event?.requestContext?.authorizer?.claims || event?.requestContext?.authorizer?.jwt?.claims || {};

    let email = claims.email || claims['cognito:username'] || null;
    if (!email && process.env.NODE_ENV === 'development') {
      email = headers['x-dev-email'] || headers['X-Dev-Email'] || process.env.DEV_DEFAULT_EMAIL || DEV_DEFAULT_EMAIL;
    }

    if (!email) {
      return errorResponse({ success: false, message: 'Não autenticado' }, 401, event);
    }

    // Buscar usuário por email
    const knex = getDbConnection();
    const user = await knex('users').where({ email }).first();
    if (!user) {
      return errorResponse({ success: false, message: 'Usuário não encontrado', email }, 404, event);
    }

    // Verificar perfis de acesso
    const userProfiles = await knex('user_access_profiles')
      .where({ user_id: user.id })
      .pluck('access_profile_id');
    const isAdmin = Array.isArray(userProfiles) && userProfiles.includes(ADMIN_PROFILE_ID);

    const products = isAdmin ? await getAllProducts() : await getProductsForUser(user.id);

    return success({ success: true, data: products }, 200, event);
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    return errorResponse({ success: false, message: 'Erro ao buscar produtos', error: err.message }, 500, event);
  }
})