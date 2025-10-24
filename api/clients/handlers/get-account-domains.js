const { success, error } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const {
  getAccessibleAccountDomains,
  ADMIN_PROFILE_ID,
} = require('../services/domain-service');

module.exports.handler = async (event) => {
  let db;
  try {
    const qs = event?.queryStringParameters || {};
    const userId = qs.userId || qs.user_id;
    if (!userId) return error('userId é obrigatório', 400);

    db = getDbConnection();
    const user = await db('users').where({ id: userId }).first();
    if (!user) return error('Usuário não encontrado', 404);

    const profileIds = await db('user_access_profiles')
      .where({ user_id: userId })
      .pluck('access_profile_id');
    const isAdmin = Array.isArray(profileIds) && profileIds.includes(ADMIN_PROFILE_ID);

    const domains = await getAccessibleAccountDomains({ userId, isAdmin });
    return success({ success: true, data: domains });
  } catch (err) {
    console.error('Erro ao listar domínios de contas:', err);
    return error(err.message || 'Erro interno ao listar domínios', 500);
  } finally {
    if (db && typeof db.destroy === 'function') {
      try {
        await db.destroy();
      } catch (destroyErr) {
        console.error('Falha ao encerrar conexão do domínio:', destroyErr);
      }
    }
  }
};
