const { createKnowledgeDocument } = require('../services/knowledge-document-service');
const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');

exports.handler = withCors(async (event) => {
  try {
    const start = Date.now();
    console.log('[KB] create start', { path: event?.path, contentLength: event?.headers?.['content-length'] || event?.headers?.['Content-Length'] });
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    console.log('[KB] parsed body keys', Object.keys(body || {}));

    // Expect JSON with base64 content
    const { filename, file_extension, file_base64, file_mime, account_id, category, category_id, document_types } = body;
    if (!filename || !account_id) {
      return errorResponse({ success: false, message: 'filename e account_id são obrigatórios' }, 400, event);
    }

    let document_url = body.document_url || null;

    if (file_base64) {
      // Basic size guard: permitir uploads diretos de até ~25MB (limite aproximado)
      const approxBytes = Math.ceil((file_base64.length * 3) / 4); // base64 -> bytes approx
      console.log('[KB] incoming base64 size ~bytes', approxBytes);
      if (approxBytes > 24.5 * 1024 * 1024) {
        return errorResponse({ success: false, message: 'Arquivo excede o limite de 25MB para upload direto. Use upload assinado.' }, 413, event);
      }
      const bucket = process.env.KNOWLEDGE_BUCKET;
      if (!bucket) {
        return errorResponse({ success: false, message: 'Bucket não configurado (KNOWLEDGE_BUCKET)' }, 500, event);
      }
      const ext = (file_extension || filename.split('.').pop() || '').replace(/^\./, '').toLowerCase();
      const contentType = file_mime || (ext === 'pdf' ? 'application/pdf' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream');
      const key = `knowledge/${account_id}/${randomUUID()}.${ext || 'bin'}`;
      const s3 = new S3Client({});
      const buffer = Buffer.from(file_base64, 'base64');
      // Abort upload if it's taking too long (25s) to avoid API Gateway timeout
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 25000);
      console.log('[KB] s3 put start', { bucket, key, contentType, size: buffer.length });
      try {
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }), { abortSignal: controller.signal });
      } catch (e) {
        console.error('[KB] s3 put failed', { message: e?.message, name: e?.name, code: e?.$metadata?.httpStatusCode });
        throw e;
      } finally {
        clearTimeout(abortTimer);
      }
      console.log('[KB] s3 put ok in ms', Date.now() - start);
      const publicDomain = process.env.KNOWLEDGE_PUBLIC_BASE || `https://${bucket}.s3.amazonaws.com`;
      document_url = `${publicDomain}/${key}`;
    }

    console.log('[KB] creating DB record');
    const created = await createKnowledgeDocument({
      filename,
      category,
      category_id,
      document_types,
      file_extension: file_extension || (filename.includes('.') ? `.${filename.split('.').pop()}` : null),
      document_url,
      account_id,
    });
    console.log('[KB] done in ms', Date.now() - start);
    return success({ success: true, data: created }, 201, event);
  } catch (err) {
    console.error('Erro ao criar knowledge document:', err);
    return errorResponse({ success: false, message: 'Erro ao criar documento', error: err.message }, 400, event);
  }
});
