const { withCors } = require('../utils/cors');
const { success, error: errorResponse } = require('../utils/response');
const service = require('../services/project_timeline-service');

// List with optional filter by projectId or productId
exports.list = withCors(async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const projectId = qs.projectId || qs.project_id || undefined;
    const productId = qs.productId || qs.product_id || undefined;
    const data = await service.list({ projectId, productId });
    return success({ success: true, data }, 200, event);
  } catch (err) {
    console.error('list project timeline error', err);
    return errorResponse({ success: false, message: 'Erro ao listar project_timeline', error: err.message }, 500, event);
  }
});

exports.get = withCors(async (event) => {
  try {
    const { code } = event.pathParameters || {};
    if (!code) return errorResponse({ success: false, message: 'code é obrigatório' }, 400, event);
    const row = await service.get(code);
    if (!row) return errorResponse({ success: false, message: 'Registro não encontrado' }, 404, event);
    return success({ success: true, data: row }, 200, event);
  } catch (err) {
    console.error('get project timeline error', err);
    return errorResponse({ success: false, message: 'Erro ao buscar project_timeline', error: err.message }, 500, event);
  }
});

exports.create = withCors(async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    if (!body.project_id) return errorResponse({ success: false, message: 'project_id é obrigatório' }, 400, event);
    const row = await service.create(body);
    return success({ success: true, data: row }, 201, event);
  } catch (err) {
    console.error('create project timeline error', err);
    return errorResponse({ success: false, message: 'Erro ao criar project_timeline', error: err.message }, 500, event);
  }
});

exports.update = withCors(async (event) => {
  try {
    const { code } = event.pathParameters || {};
    if (!code) return errorResponse({ success: false, message: 'code é obrigatório' }, 400, event);
    const body = event.body ? JSON.parse(event.body) : {};
    const row = await service.update(code, body);
    return success({ success: true, data: row }, 200, event);
  } catch (err) {
    console.error('update project timeline error', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar project_timeline', error: err.message }, 500, event);
  }
});

exports.remove = withCors(async (event) => {
  try {
    const { code } = event.pathParameters || {};
    if (!code) return errorResponse({ success: false, message: 'code é obrigatório' }, 400, event);
    await service.remove(code);
    return success({ success: true }, 200, event);
  } catch (err) {
    console.error('delete project timeline error', err);
    return errorResponse({ success: false, message: 'Erro ao excluir project_timeline', error: err.message }, 500, event);
  }
});
