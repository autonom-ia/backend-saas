/**
 * Handler para atualizar um item do Kanban por ID
 */
const { updateKanbanItem } = require('../services/kanban-items-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) return error('Parâmetro id é obrigatório', 400);

    const body = JSON.parse(event.body || '{}');
    const updated = await updateKanbanItem(id, body);

    await closeDbConnection();
    return success(updated);
  } catch (err) {
    console.error('Erro ao atualizar kanban_item:', err);
    try { await closeDbConnection(); } catch {}
    return error(err.message || 'Erro interno ao atualizar kanban_item', 500);
  }
};
