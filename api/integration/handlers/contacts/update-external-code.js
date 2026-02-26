const { getDbConnection } = require('../../utils/database');
const { requireInternalToken } = require('../../utils/internal-auth');

exports.handler = async (event) => {
  try {
    requireInternalToken(event);

    const knex = getDbConnection();

    const contactId = event.pathParameters && event.pathParameters.contactId;
    if (!contactId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'contactId é obrigatório' }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Corpo da requisição inválido' }),
      };
    }

    const externalCode = body && body.external_code;
    if (!externalCode) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'external_code é obrigatório' }),
      };
    }

    const [updated] = await knex('contact')
      .where('id', contactId)
      .update({ external_code: externalCode, updated_at: new Date() })
      .returning('*');

    if (!updated) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Contato não encontrado' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: updated }),
    };
  } catch (err) {
    if (err && err.statusCode === 401) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Unauthorized' }),
      };
    }

    console.error('[updateContactExternalCode] Erro:', err);
    return {
      statusCode: err.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Erro ao atualizar external_code do contato',
        error: err.message,
      }),
    };
  }
};
