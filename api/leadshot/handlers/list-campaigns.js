const { success, error: errorResponse } = require('../utils/response');
const { listCampaignsByProduct } = require('../services/campaign-service');

exports.handler = async (event) => {
  try {
    const productId = event?.queryStringParameters?.productId;
    if (!productId) {
      return errorResponse({ success: false, message: 'productId é obrigatório' }, 400, event);
    }

    const rows = await listCampaignsByProduct(productId);
    return success({ success: true, data: rows }, 200, event);
  } catch (err) {
    console.error('[leadshot/list-campaigns] error:', err);
    return errorResponse({ success: false, message: 'Erro ao listar campanhas', error: err.message }, 500, event);
  }
};
