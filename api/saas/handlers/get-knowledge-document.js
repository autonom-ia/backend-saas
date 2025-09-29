const { getKnowledgeDocument } = require('../services/knowledge-document-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

exports.handler = withCors(async (event) => {
  try {
    const documentId = event?.pathParameters?.documentId;
    if (!documentId) {
      return errorResponse({ success: false, message: 'Parâmetro documentId é obrigatório' }, 400, event);
    }

    const item = await getKnowledgeDocument(documentId);
    if (!item) {
      return errorResponse({ success: false, message: 'Documento não encontrado' }, 404, event);
    }

    return success({ success: true, data: item }, 200, event);
  } catch (err) {
    console.error('Erro ao obter knowledge document:', err);
    return errorResponse({ success: false, message: 'Erro ao obter documento', error: err.message }, 500, event);
  }
});
