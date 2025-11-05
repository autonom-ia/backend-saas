const { getDbConnection } = require('../utils/database');
const { getAllAccounts } = require('../services/account-service');
const { success, error: errorResponse } = require('../utils/response');

/**
 * Handler para listar contas filtradas por productId ou domain (querystring)
 */
exports.handler = async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const productId = qs.productId || qs.product_id;
    const domain = qs.domain;

    // Aceita pelo menos um filtro
    if (!productId && !domain) {
      return errorResponse({
        success: false,
        message: 'Pelo menos um parâmetro é obrigatório: productId ou domain'
      }, 400, event);
    }

    console.log(`Listando contas com filtros:`, { productId, domain });
    
    const filters = {};
    if (productId) filters.productId = productId;
    if (domain) filters.domain = domain;

    const accounts = await getAllAccounts(filters);
    
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
