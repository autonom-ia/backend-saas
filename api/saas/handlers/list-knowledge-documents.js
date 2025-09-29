const { listKnowledgeDocuments } = require('../services/knowledge-document-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

exports.handler = withCors(async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const accountId = qs.accountId || qs.account_id || undefined;

    const items = await listKnowledgeDocuments({ accountId });

    return success({ success: true, data: items }, 200, event);
  } catch (err) {
    console.error('Erro ao listar knowledge documents:', err);
    return errorResponse({ success: false, message: 'Erro ao listar documentos', error: err.message }, 500, event);
  }
});
