const { deleteKnowledgeDocument, getKnowledgeDocument } = require('../services/knowledge-document-service');
const { getAccountById } = require('../services/account-service');
const { getAccountParameterByName } = require('../services/account-parameter-service');
const { getAllProductParameters } = require('../services/product-parameter-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

exports.handler = withCors(async (event) => {
  try {
    const documentId = event?.pathParameters?.documentId;
    if (!documentId) {
      return errorResponse({ success: false, message: 'Parâmetro documentId é obrigatório' }, 400, event);
    }

    // Parse optional body for account_id and IdToken (required to notify RAG)
    const body = typeof event?.body === 'string' ? JSON.parse(event.body || '{}') : (event?.body || {});
    const accountId = body?.account_id;
    const idToken = body?.IdToken;

    if (!accountId) {
      return errorResponse({ success: false, message: 'account_id é obrigatório no corpo' }, 400, event);
    }
    if (!idToken) {
      return errorResponse({ success: false, message: 'IdToken é obrigatório no corpo' }, 400, event);
    }

    // Load and validate document
    const doc = await getKnowledgeDocument(documentId);
    if (!doc) {
      return errorResponse({ success: false, message: 'Documento não encontrado' }, 404, event);
    }
    if (String(doc.account_id) !== String(accountId)) {
      return errorResponse({ success: false, message: 'Documento não pertence à account informada' }, 400, event);
    }

    // Resolve faq_rag
    let ragName = null;
    const accountParam = await getAccountParameterByName(accountId, 'faq_rag');
    if (accountParam && accountParam.value) {
      ragName = accountParam.value;
    } else {
      const account = await getAccountById(accountId);
      const productId = account?.product_id;
      if (productId) {
        const allProdParams = await getAllProductParameters(productId);
        const pp = (allProdParams || []).find(p => p?.name === 'faq_rag' && p?.value);
        if (pp) ragName = pp.value;
      }
    }

    // Notify RAG about deletion if possible
    try {
      const payload = {
        document_url: doc.document_url,
        document_id: doc.id,
        file_name: doc.filename,
        file_extension: doc.file_extension || null,
        raq_name: ragName,
        IdToken: idToken,
        operation: 'delete',
      };
      const targetUrl = 'https://auto.autonomia.site/webhook/processing-rag';
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (notifyErr) {
      console.warn('Falha ao notificar RAG sobre exclusão:', notifyErr?.message || notifyErr);
      // Prossegue com o soft delete mesmo em caso de falha de notificação
    }

    await deleteKnowledgeDocument(documentId);
    return success({ success: true }, 200, event);
  } catch (err) {
    console.error('Erro ao excluir knowledge document:', err);
    return errorResponse({ success: false, message: 'Erro ao excluir documento', error: err.message }, 400, event);
  }
});
