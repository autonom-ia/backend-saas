/**
 * Handler para excluir um item do Kanban por ID
 */
const { deleteKanbanItem } = require('../services/kanban-items-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) return error('Parâmetro id é obrigatório', 400);

    const result = await deleteKanbanItem(id);
    await closeDbConnection();
    return success(result);
  } catch (err) {
    console.error('Erro ao excluir kanban_item:', err);
    try { await closeDbConnection(); } catch {}
    return error(err.message || 'Erro interno ao excluir kanban_item', 500);
  }
};
