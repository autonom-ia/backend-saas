/**
 * Handler para retornar a quantidade de itens do Kanban por etapa
 * (agrupado por kanban_code ou, se ausente, por name da conversation_funnel_step),
 * filtrando por domain de company via joins em product e account.
 */
const { countKanbanItemsByStageForDomain } = require('../services/kanban-items-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const domain = qs.domain;

    if (!domain) {
      return error('Parâmetro domain é obrigatório', 400);
    }

    const result = await countKanbanItemsByStageForDomain({ domain });

    await closeDbConnection();
    return success(result);
  } catch (err) {
    console.error('Erro ao obter contagem de kanban_items por etapa:', err);
    try { await closeDbConnection(); } catch {}
    return error(err.message || 'Erro interno ao obter contagem de kanban_items por etapa', 500);
  }
};
