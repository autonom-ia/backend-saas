/**
 * Handler para criar contato
 */
const { createContact } = require('../services/contact-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.account_id) {
      return error('Campo account_id é obrigatório no corpo da requisição', 400);
    }
    const created = await createContact(body);
    return success({ message: 'Contato criado com sucesso', data: created });
  } catch (err) {
    console.error('Erro ao criar contato:', err);
    return error(err.message || 'Erro interno ao criar contato', 500);
  } finally {
    await closeDbConnection();
  }
};
