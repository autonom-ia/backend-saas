const { getAllAccounts, getAccountsForUser } = require('../services/account-service');
const { success, error: errorResponse } = require('../utils/response');
const { getUserFromEvent } = require('../utils/auth-user');

/**
 * Handler para listar contas filtradas por productId ou domain (querystring)
 */
exports.handler = async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const productId = qs.productId || qs.product_id;
    const domain = qs.domain;

    // // Aceita pelo menos um filtro
    // if (!productId && !domain) {
    //   return errorResponse({
    //     success: false,
    //     message: 'Pelo menos um parâmetro é obrigatório: productId ou domain'
    //   }, 400, event);
    // }

    console.log(`Listando contas com filtros:`, { productId, domain });
    
    const filters = {};
    if (productId) filters.productId = productId;
    if (domain) filters.domain = domain;

    // Resolver usuário autenticado via auth-user (Cognito JWT -> users)
    const userContext = await getUserFromEvent(event);

    let accounts;
    if (!userContext || !userContext.user || !userContext.user.id) {
      // Sem usuário resolvido: por segurança, não retorna contas
      console.warn('[list-accounts] Usuário não resolvido a partir do JWT; retornando lista vazia');
      accounts = [];
    } else {
      // Para usuários não admin, getAccountsForUser aplica filtro por user_accounts.
      accounts = await getAccountsForUser(userContext.user.id, filters);
    }
    
    console.log(`Encontradas ${accounts.length} contas`);
    
    return success({ success: true, data: accounts, count: accounts.length }, 200, event);
  } catch (error) {
    console.error('Erro ao listar contas:', error);
    return errorResponse({
      success: false,
      message: 'Erro ao listar contas',
      error: error.message
    }, 500, event);
  }
};
