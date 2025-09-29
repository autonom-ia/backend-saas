const { createKnowledgeDocument } = require('../services/knowledge-document-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

exports.handler = withCors(async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});

    const created = await createKnowledgeDocument({
      filename: body.filename,
      category: body.category,
      category_id: body.category_id,
      document_types: body.document_types,
      file_extension: body.file_extension,
      document_url: body.document_url,
      account_id: body.account_id,
    });

    return success({ success: true, data: created }, 201, event);
  } catch (err) {
    console.error('Erro ao criar knowledge document:', err);
    return errorResponse({ success: false, message: 'Erro ao criar documento', error: err.message }, 400, event);
  }
});
