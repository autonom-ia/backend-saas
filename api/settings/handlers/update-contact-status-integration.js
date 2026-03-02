const { success, error } = require('../utils/response');
const { getDbConnection, closeDbConnection } = require('../utils/database');
const { requireInternalToken } = require('../../utils/internal-auth');

/**
 * Handler para atualizar o status (external_status) de um contato via token de integração
 * Espera no body: { contact_id: string, status: string }
 * Valida o token no header: x-internal-token
 */
module.exports.handler = async (event) => {
  let db;

  try {
    // Validação do token de integração
    requireInternalToken(event);

    const body = JSON.parse(event.body || '{}');
    const { contact_id, status } = body;

    if (!contact_id) {
      return error('Campo contact_id é obrigatório no corpo da requisição', 400);
    }

    if (!status) {
      return error('Campo status é obrigatório no corpo da requisição', 400);
    }

    db = getDbConnection();

    const [updatedContact] = await db('contact')
      .where({ id: contact_id })
      .update({
        external_status: status,
        updated_at: db.fn.now(),
      })
      .returning('*');

    if (!updatedContact) {
      return error('Contato não encontrado', 404);
    }

    return success({
      message: 'Status do contato atualizado com sucesso',
      data: updatedContact,
    });
  } catch (err) {
    console.error('[update-contact-status-integration] Erro ao atualizar status do contato', err);

    const statusCode = err.statusCode || 500;
    return error(err.message || 'Erro interno ao atualizar status do contato', statusCode);
  } finally {
    if (db) {
      await closeDbConnection();
    }
  }
};
