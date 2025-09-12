/**
 * Handler para listar itens do Kanban com filtros e joins para nomes relacionados
 */
const { listKanbanItems } = require('../services/kanban-items-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const accountId = qs.accountId || qs.account_id;
    const limit = qs.limit ? parseInt(qs.limit, 10) : undefined;
    const offset = qs.offset ? parseInt(qs.offset, 10) : undefined;

    const items = await listKanbanItems({ accountId, limit, offset });

    await closeDbConnection();
    return success(items);
  } catch (err) {
    console.error('Erro ao listar kanban_items:', err);
    try { await closeDbConnection(); } catch {}
    return error(err.message || 'Erro interno ao listar kanban_items', 500);
  }
};
