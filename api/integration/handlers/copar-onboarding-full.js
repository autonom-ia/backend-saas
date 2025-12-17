const { callCoparOnboardingFull } = require('../services/copar-service-new');

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

    console.log('[Copar Handler FULL] Body bruto recebido', event.body);
    console.log('[Copar Handler FULL] Body parseado', body);

    const result = await callCoparOnboardingFull(body);
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

    console.error('[Copar Handler FULL] Erro inesperado', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, message: 'Erro interno', error: err.message }),
    };
  }
};
