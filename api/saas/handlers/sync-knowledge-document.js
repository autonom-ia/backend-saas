const { success, error: errorResponse } = require('../utils/response');
const { getDbConnection } = require('../utils/database');
const { getKnowledgeDocument } = require('../services/knowledge-document-service');
const { getAccountById } = require('../services/account-service');
const { getAccountParameterByName } = require('../services/account-parameter-service');
const { getAllProductParameters } = require('../services/product-parameter-service');

/**
 * POST /Autonomia/Saas/KnowledgeDocuments/{documentId}/sync
 * Body: { account_id: string, IdToken: string }
 *
 * Passos:
 * 1) Busca faq_rag em account_parameter; se não houver, busca em product_parameter da account.
 * 2) Chama https://auto.autonomia.site/webhook/processing-rag com os dados do documento.
 * 3) Retorna 202 Accepted em caso de disparo com sucesso.
 */
exports.handler = async (event) => {
  try {
    const documentId = event?.pathParameters?.documentId;
    const body = typeof event?.body === 'string' ? JSON.parse(event.body || '{}') : (event?.body || {});
    const accountId = body?.account_id;
    const idToken = body?.IdToken;

    if (!documentId) {
      return errorResponse({ success: false, message: 'documentId é obrigatório na rota' }, 400);
    }
    if (!accountId) {
      return errorResponse({ success: false, message: 'account_id é obrigatório no corpo' }, 400);
    }
    if (!idToken) {
      return errorResponse({ success: false, message: 'IdToken é obrigatório no corpo' }, 400);
    }

    // Carrega documento
    const doc = await getKnowledgeDocument(documentId);
    if (!doc) {
      return errorResponse({ success: false, message: 'Documento não encontrado' }, 404);
    }
    if (String(doc.account_id) !== String(accountId)) {
      return errorResponse({ success: false, message: 'Documento não pertence à account informada' }, 400);
    }

    // Resolve faq_rag
    let ragName = null;
    const accountParam = await getAccountParameterByName(accountId, 'faq_rag');
    if (accountParam && accountParam.value) {
      ragName = accountParam.value;
    } else {
      // Busca no produto vinculado à account
      const account = await getAccountById(accountId);
      const productId = account?.product_id;
      if (productId) {
        const allProdParams = await getAllProductParameters(productId);
        const pp = (allProdParams || []).find(p => p?.name === 'faq_rag' && p?.value);
        if (pp) ragName = pp.value;
      }
    }

    if (!ragName) {
      return errorResponse({ success: false, message: 'Parâmetro faq_rag não configurado para a conta nem para o produto' }, 400);
    }

    const payload = {
      document_url: doc.document_url,
      document_id: doc.id,
      file_name: doc.filename,
      file_extension: doc.file_extension || null,
      raq_name: ragName,
      IdToken: idToken,
      operation: 'create',
    };

    const targetUrl = 'https://auto.autonomia.site/webhook/processing-rag';
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return errorResponse({ success: false, message: 'Falha ao chamar processamento RAG', status: resp.status, statusText: resp.statusText, body: t }, 502);
    }

    return success({ success: true, message: 'Sincronização disparada com sucesso', data: { document_id: doc.id, account_id: accountId } }, 202);
  } catch (err) {
    console.error('Erro ao sincronizar documento do conhecimento:', err);
    return errorResponse({ success: false, message: 'Erro ao sincronizar documento', error: err?.message }, 500);
  }
};
