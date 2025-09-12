/**
 * Handler para obter um item do Kanban por ID (com joins para nomes relacionados)
 */
const { getKanbanItem } = require('../services/kanban-items-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) return error('Parâmetro id é obrigatório', 400);

    const item = await getKanbanItem(id);
    if (!item) {
      await closeDbConnection();
      return error('Item não encontrado', 404);
    }

    await closeDbConnection();
    return success(item);
  } catch (err) {
    console.error('Erro ao obter kanban_item:', err);
    try { await closeDbConnection(); } catch {}
    return error(err.message || 'Erro interno ao obter kanban_item', 500);
  }
};
