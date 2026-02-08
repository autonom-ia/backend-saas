const { success, error: errorResponse } = require('../utils/response');
const { getUserFromEvent } = require('../utils/auth-user');
const { getUserPermissions } = require('../services/user-company-service');

/**
 * Retorna as permissões do usuário autenticado (canSeeAll = admin autonomia).
 * Usado pelo portal para saber se deve pedir "todas as assinaturas" ao financial-service.
 */
exports.handler = async (event) => {
  try {
    const userContext = await getUserFromEvent(event);
    if (!userContext || !userContext.user || !userContext.user.id) {
      return errorResponse(
        { success: false, message: 'Não autorizado' },
        401,
        event
      );
    }

    const permissions = await getUserPermissions(userContext.user.id);
    return success(
      {
        success: true,
        data: {
          canSeeAll: permissions.canSeeAll,
          isAdmin: permissions.isAdmin,
          isAdminAutonomia: permissions.isAdminAutonomia,
          companyId: permissions.companyId ?? null,
          isAutonomia: permissions.isAutonomia ?? false,
        },
      },
      200,
      event
    );
  } catch (err) {
    console.error('Erro ao obter permissões do usuário:', err);
    return errorResponse(
      {
        success: false,
        message: 'Erro ao obter permissões',
        error: err.message,
      },
      500,
      event
    );
  }
};
