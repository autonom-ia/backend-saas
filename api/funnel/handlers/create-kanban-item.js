/**
 * Handler para criar um novo item do Kanban
 */
const { createKanbanItem } = require('../services/kanban-items-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');

    // Validação básica
    const required = ['account_id', 'funnel_id', 'funnel_stage_id', 'user_session_id', 'position', 'summary', 'title'];
    const missing = required.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length) return error(`Campos obrigatórios ausentes: ${missing.join(', ')}`, 400);

    const created = await createKanbanItem(body);
    await closeDbConnection();
    return success(created, 201);
  } catch (err) {
    console.error('Erro ao criar kanban_item:', err);
    try { await closeDbConnection(); } catch {}
    return error(err.message || 'Erro interno ao criar kanban_item', 500);
  }
};
