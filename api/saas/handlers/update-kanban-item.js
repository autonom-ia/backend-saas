/**
 * SAAS handler para atualizar um item do Kanban
 */
const { updateKanbanItem } = require('../services/kanban-items-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  try {
    const { itemId } = event.pathParameters || {};
    if (!itemId) {
      return error('itemId é obrigatório', 400);
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return error('Corpo da requisição inválido', 400);
    }

    const updated = await updateKanbanItem(itemId, body);

    await closeDbConnection();
    return success(updated);
  } catch (err) {
    console.error('Erro ao atualizar kanban_item (saas):', err);
    try { await closeDbConnection(); } catch {}
    return error(err.message || 'Erro interno ao atualizar kanban_item', 500);
  }
};
