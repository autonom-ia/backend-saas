/**
 * Handler para listar contatos com filtro opcional por telefone
 */
const { listContacts } = require('../services/contact-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

module.exports.handler = async (event) => {
  try {
    const query = event.queryStringParameters || {};
    const accountId = query.accountId;
    if (!accountId) {
      return error('Parâmetro accountId é obrigatório', 400);
    }
    const phone = query.phone;
    const limit = query.limit ? Number(query.limit) : undefined;
    const offset = query.offset ? Number(query.offset) : undefined;

    const data = await listContacts({ accountId, phone, limit, offset });
    return success({ message: 'Contatos listados com sucesso', data });
  } catch (err) {
    console.error('Erro ao listar contatos:', err);
    return error(err.message || 'Erro interno ao listar contatos', 500);
  } finally {
    await closeDbConnection();
  }
};
