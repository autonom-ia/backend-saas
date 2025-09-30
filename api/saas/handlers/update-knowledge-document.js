const { updateKnowledgeDocument } = require('../services/knowledge-document-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');

exports.handler = withCors(async (event) => {
  try {
    const documentId = event?.pathParameters?.documentId;
    if (!documentId) {
      return errorResponse({ success: false, message: 'Parâmetro documentId é obrigatório' }, 400, event);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});

    const updated = await updateKnowledgeDocument(documentId, body);
    if (!updated) {
      return errorResponse({ success: false, message: 'Documento não encontrado' }, 404, event);
    }

    return success({ success: true, data: updated }, 200, event);
  } catch (err) {
    console.error('Erro ao atualizar knowledge document:', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar documento', error: err.message }, 400, event);
  }
});
