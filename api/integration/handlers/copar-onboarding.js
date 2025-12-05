const { callCoparOnboarding } = require('../services/copar-service');

const parseJsonBody = (event) => {
  if (!event || !event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch (parseErr) {
    const err = new Error('INVALID_JSON_BODY');
    err.code = 'INVALID_JSON_BODY';
    throw err;
  }
};

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);

    console.log('[Copar Handler] Body bruto recebido', event.body);

    console.log('[Copar Handler] Body parseado', body);

    console.log('[Copar Handler] Payload recebido (resumo)', {
      hasPdf: !!body.pdf_conta_luz,
      tipo: body.tipo,
      email: body.email,
      telefone: body.telefone,
      uuid_sessao: body.uuid_sessao,
    });

    const result = await callCoparOnboarding(body);
    return result;
  } catch (err) {
    if (err && err.code === 'INVALID_JSON_BODY') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ success: false, message: 'Corpo da requisição inválido' }),
      };
    }

    console.error('[Copar Handler] Erro inesperado', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, message: 'Erro interno', error: err.message }),
    };
  }
};
