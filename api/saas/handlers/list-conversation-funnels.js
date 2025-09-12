const { getDbConnection } = require('../utils/database');
const { getAllFunnels } = require('../services/conversation-funnel-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

/**
 * Handler para listar funis de conversação
 */
exports.handler = withCors(async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const defaultOnly = String(qs.defaultOnly || '').toLowerCase() === 'true';
    const accountId = qs.accountId || undefined;

    const items = await getAllFunnels({ defaultOnly, accountId });
    return success({ success: true, data: items }, 200, event);
  } catch (error) {
    console.error('Erro ao listar funis:', error);
    return errorResponse({ success: false, message: 'Erro ao listar funis', error: error.message }, 500, event);
  }
});
