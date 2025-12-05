const { callCoparOnboardingPaymentStep } = require('../services/copar-service');

exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ success: false, message: 'Corpo da requisição inválido' }),
      };
    }

    console.log('[Copar Payment Handler] Payload recebido', {
      sessao_uuid: body.sessao_uuid || body.uuid_sessao,
      metodo_pagamento: body.metodo_pagamento,
    });

    const result = await callCoparOnboardingPaymentStep(body);
    return result;
  } catch (err) {
    console.error('[Copar Payment Handler] Erro inesperado', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, message: 'Erro interno', error: err.message }),
    };
  }
};
