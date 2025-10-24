const { success, error } = require('../utils/response');
const {
  listAccessibleDomainsByUserId,
} = require('../services/domain-service');

module.exports.handler = async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const userId = qs.userId || qs.user_id;
    if (!userId) return error('userId é obrigatório', 400);

    const domains = await listAccessibleDomainsByUserId(userId);
    return success({ success: true, data: domains });
  } catch (err) {
    console.error('Erro ao listar domínios de contas:', err);
    const status = (err && err.statusCode) ? err.statusCode : 500;
    return error(err.message || 'Erro interno ao listar domínios', status);
  }
};
