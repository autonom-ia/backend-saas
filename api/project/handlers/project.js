const { withCors } = require('../utils/cors');
const { success, error: errorResponse } = require('../utils/response');
const service = require('../services/project-service');

exports.list = withCors(async (event) => {
  try {
    const qs = event?.queryStringParameters || {};
    const productId = qs.productId || qs.product_id || undefined;
    const data = await service.list({ productId });
    return success({ success: true, data }, 200, event);
  } catch (err) {
    console.error('list projects error', err);
    return errorResponse({ success: false, message: 'Erro ao listar projetos', error: err.message }, 500, event);
  }
});

exports.get = withCors(async (event) => {
  try {
    const { projectId } = event.pathParameters || {};
    if (!projectId) return errorResponse({ success: false, message: 'projectId é obrigatório' }, 400, event);
    const row = await service.get(projectId);
    if (!row) return errorResponse({ success: false, message: 'Projeto não encontrado' }, 404, event);
    return success({ success: true, data: row }, 200, event);
  } catch (err) {
    console.error('get project error', err);
    return errorResponse({ success: false, message: 'Erro ao buscar projeto', error: err.message }, 500, event);
  }
});

exports.create = withCors(async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    if (!body.name) return errorResponse({ success: false, message: 'name é obrigatório' }, 400, event);
    if (!body.product_id) return errorResponse({ success: false, message: 'product_id é obrigatório' }, 400, event);
    const row = await service.create(body);
    return success({ success: true, data: row }, 201, event);
  } catch (err) {
    console.error('create project error', err);
    return errorResponse({ success: false, message: 'Erro ao criar projeto', error: err.message }, 500, event);
  }
});

exports.update = withCors(async (event) => {
  try {
    const { projectId } = event.pathParameters || {};
    if (!projectId) return errorResponse({ success: false, message: 'projectId é obrigatório' }, 400, event);
    const body = event.body ? JSON.parse(event.body) : {};
    const row = await service.update(projectId, body);
    return success({ success: true, data: row }, 200, event);
  } catch (err) {
    console.error('update project error', err);
    return errorResponse({ success: false, message: 'Erro ao atualizar projeto', error: err.message }, 500, event);
  }
});

exports.remove = withCors(async (event) => {
  try {
    const { projectId } = event.pathParameters || {};
    if (!projectId) return errorResponse({ success: false, message: 'projectId é obrigatório' }, 400, event);
    await service.remove(projectId);
    return success({ success: true }, 200, event);
  } catch (err) {
    console.error('delete project error', err);
    return errorResponse({ success: false, message: 'Erro ao excluir projeto', error: err.message }, 500, event);
  }
});
