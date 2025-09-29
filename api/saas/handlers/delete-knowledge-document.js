const { deleteKnowledgeDocument } = require('../services/knowledge-document-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

exports.handler = withCors(async (event) => {
  try {
    const documentId = event?.pathParameters?.documentId;
    if (!documentId) {
      return errorResponse({ success: false, message: 'Parâmetro documentId é obrigatório' }, 400, event);
    }

    await deleteKnowledgeDocument(documentId);
    return success({ success: true }, 200, event);
  } catch (err) {
    console.error('Erro ao excluir knowledge document:', err);
    return errorResponse({ success: false, message: 'Erro ao excluir documento', error: err.message }, 400, event);
  }
});
