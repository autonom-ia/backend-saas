const { getDbConnection } = require('../utils/database');
const { success, error: errorResponse } = require('../utils/response');

exports.handler = async (event) => {
  try {
    const knex = getDbConnection();
    const accountId = event.pathParameters && event.pathParameters.accountId;

    if (!accountId) {
      return errorResponse({ success: false, message: 'accountId é obrigatório' }, 400);
    }

    const query = knex('account_integration_api')
      .where('account_id', accountId);

    const isActive = event.queryStringParameters && event.queryStringParameters.is_active;
    if (isActive !== undefined) {
      if (isActive === 'true') {
        query.andWhere('is_active', true);
      } else if (isActive === 'false') {
        query.andWhere('is_active', false);
      }
    }

    const items = await query.orderBy('created_at', 'desc');

    return success({ success: true, data: items });
  } catch (err) {
    console.error('[listAccountIntegrationApis] Erro:', err);
    return errorResponse({ success: false, message: 'Erro ao listar integrações de API', error: err.message }, 500);
  }
};
