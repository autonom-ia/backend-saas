/**
 * Handler para atualizar e retornar contato por external_code e accountId (POST)
 */
const { updateContactByExternalCode } = require('../services/contact-query-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const externalCode = body.external_code || body.externalCode;
    const status = body.status;
    const finalLink = body.finalLink || body.final_link;

    if (!externalCode) return error('Campo external_code é obrigatório', 400);

    const updated = await updateContactByExternalCode({ externalCode, status, finalLink });
    if (!updated) return error('Contato não encontrado', 404);

    return success({ message: 'Contato atualizado', data: updated });
  } catch (err) {
    console.error('Erro ao atualizar contato por external_code:', err);
    return error(err.message || 'Erro interno');
  } finally {
    await closeDbConnection();
  }
};
