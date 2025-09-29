/**
 * Handler para atualizar contato
 */
const { updateContact } = require('../services/contact-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { id, ...data } = body;
    if (!id) {
      return error('Parâmetro id é obrigatório no corpo da requisição', 400);
    }

    const updated = await updateContact(id, data);
    if (!updated) {
      return error('Contato não encontrado', 404);
    }
    return success({ message: 'Contato atualizado com sucesso', data: updated });
  } catch (err) {
    console.error('Erro ao atualizar contato:', err);
    return error(err.message || 'Erro interno ao atualizar contato', 500);
  } finally {
    await closeDbConnection();
  }
};
