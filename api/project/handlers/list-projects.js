const { success, error: errorResponse } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const { withCors } = require('../utils/cors');
const ProjectService = require('../services/project-service');

/**
 * Lista projetos considerando o perfil do usuário autenticado.
 * - Admin: retorna todos os projetos (opcionalmente filtrado por productId)
 * - Não-admin: retorna apenas projetos relacionados aos products das contas do usuário
 */
exports.handler = withCors(async (event) => {
  try {
    const ADMIN_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';

    // Claims do Cognito
    const claims = event?.requestContext?.authorizer?.claims || event?.requestContext?.authorizer?.jwt?.claims || {};
    const email = claims.email || claims['cognito:username'] || null;
    if (!email) {
      return errorResponse({ success: false, message: 'Não autenticado' }, 401, event);
    }

    // Query params
    const qs = event?.queryStringParameters || {};
    const productId = qs.productId || qs.product_id || undefined;

    // Buscar usuário
    const knex = getDbConnection();
    const user = await knex('users').where({ email }).first();
    if (!user) {
      return errorResponse({ success: false, message: 'Usuário não encontrado' }, 404, event);
    }

    // Verificar perfis do usuário
    const userProfiles = await knex('user_access_profiles')
      .where({ user_id: user.id })
      .pluck('access_profile_id');
    const isAdmin = Array.isArray(userProfiles) && userProfiles.includes(ADMIN_PROFILE_ID);

    // Buscar projetos conforme perfil
    const projects = isAdmin
      ? await ProjectService.list({ productId })
      : await ProjectService.listForUser(user.id, { productId });

    return success({ success: true, data: projects }, 200, event);
  } catch (error) {
    console.error('Erro ao listar projetos (por usuário):', error);
    return errorResponse({ success: false, message: 'Erro ao listar projetos', error: error.message }, 500, event);
  }
});
