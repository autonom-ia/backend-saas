const { getDbConnection } = require('../../utils/database');
const { requireInternalToken } = require('../../utils/internal-auth');

exports.handler = async (event) => {
  try {
    requireInternalToken(event);

    const knex = getDbConnection();

    const contactId = event.queryStringParameters && event.queryStringParameters.contact_id;
    const externalCode = event.queryStringParameters && event.queryStringParameters.external_code;

    if (!contactId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'contact_id é obrigatório' }),
      };
    }

    const query = knex('contact').where('id', contactId);

    if (externalCode) {
      query.andWhere('external_code', externalCode);
    }

    const contacts = await query.orderBy('created_at', 'desc');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: contacts }),
    };
  } catch (err) {
    if (err && err.statusCode === 401) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Unauthorized' }),
      };
    }

    console.error('[listContactsByContactId] Erro:', err);
    return {
      statusCode: err.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Erro ao listar contatos por contact_id',
        error: err.message,
      }),
    };
  }
};
