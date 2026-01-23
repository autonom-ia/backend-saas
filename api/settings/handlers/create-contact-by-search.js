const { createContactsFromIntelligence } = require('../services/contact-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { account_id, campaign_id, contacts } = body;

    if (!account_id) {
      return error('Campo account_id é obrigatório no corpo da requisição', 400);
    }
    if (!campaign_id) {
      return error('Campo campaign_id é obrigatório no corpo da requisição', 400);
    }

    const created = await createContactsFromIntelligence({ account_id, campaign_id, contacts });
    return success({ message: 'Contatos importados com sucesso', data: created });
  } catch (err) {
    console.error('Erro ao importar contatos de inteligência:', err);
    return error(err.message || 'Erro interno ao importar contatos de inteligência', 500);
  } finally {
    await closeDbConnection();
  }
};
