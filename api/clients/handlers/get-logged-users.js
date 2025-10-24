/**
 * Handler para retornar usuários logados (agentes online) na plataforma.
 * Usa a função existente getOnlineAgents de assign-service.
 */

const { getLoggedUsersDetails } = require('../services/assign-service');
const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};

    // Permitir accountId via query ?accountId= ou via /:accountId futuramente
    const rawAccountId = qs.accountId || qs.account_id || pathParams.accountId || pathParams.account_id;
    const accountId = rawAccountId ? parseInt(rawAccountId, 10) : 6;
    if (rawAccountId && Number.isNaN(accountId)) {
      return error('Parâmetro accountId inválido.', 400);
    }

    // Receber domain (prefix) do front opcionalmente
    const rawDomain = qs.domain || qs.prefix || pathParams.domain || pathParams.prefix;
    const domain = rawDomain ? String(rawDomain).trim() : 'empresta';
    if (rawDomain && !domain) {
      return error('Parâmetro domain inválido.', 400);
    }

    const users = await getLoggedUsersDetails(accountId, domain);

    return success({
      accountId,
      count: Array.isArray(users) ? users.length : 0,
      data: users || [],
    });
  } catch (err) {
    console.error('Erro no handler get-logged-users:', err);
    return error(err.message || 'Erro interno ao obter usuários logados.', 500);
  }
};
