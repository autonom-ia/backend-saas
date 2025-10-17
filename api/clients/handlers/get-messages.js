const { success, error } = require('../utils/response');
const { listMessagesByContext } = require('../services/messages-service');

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { chatwoot_account, chatwoot_inbox, chatwoot_conversations, domain } = body;

    if (!chatwoot_account || !chatwoot_inbox || !chatwoot_conversations || !domain) {
      return error('Parâmetros chatwoot_account, chatwoot_inbox, chatwoot_conversations e domain são obrigatórios.', 400);
    }

    // Usar `domain` como prefixo para conexão (ex.: '/autonomia/' ou 'AUTONOMIA')
    const prefix = String(domain);

    const data = await listMessagesByContext(prefix, chatwoot_account, chatwoot_inbox, chatwoot_conversations, 100);

    return success({ data });
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
    return error(err.message || 'Erro interno ao buscar mensagens', 500);
  }
};
