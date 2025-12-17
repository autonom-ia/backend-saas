const { success, error: errorResponse } = require('../utils/response');

// Handler específico para chamar o partial-register da Eu Viajo Seguro
// Não cria conta; apenas dispara a integração externa
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const {
      productId,
      name,
      email,
      document,
    } = body;

    if (!productId) {
      return errorResponse({ success: false, message: 'productId é obrigatório' }, 400);
    }
    if (!name || !name.trim()) {
      return errorResponse({ success: false, message: 'name é obrigatório' }, 400);
    }
    if (!email || !email.trim()) {
      return errorResponse({ success: false, message: 'email é obrigatório' }, 400);
    }
    if (!document || !document.toString().trim()) {
      return errorResponse({ success: false, message: 'document é obrigatório' }, 400);
    }

    const evsProductId = process.env.EVS_PRODUCT_ID;
    const token = process.env.EUVIAJO_CLIENT_API_TOKEN;

    if (!evsProductId) {
      return errorResponse({ success: false, message: 'EVS_PRODUCT_ID não configurado' }, 500);
    }

    if (productId !== evsProductId) {
      return errorResponse({ success: false, message: 'Produto informado não está configurado para integração Eu Viajo Seguro' }, 400);
    }

    if (!token) {
      return errorResponse({ success: false, message: 'Token Eu Viajo Seguro não configurado' }, 500);
    }

    const rawDoc = document.toString().replace(/\D/g, '');
    let cpf = null;
    let cnpj = null;

    if (rawDoc.length === 11) {
      cpf = rawDoc;
    } else if (rawDoc.length === 14) {
      cnpj = rawDoc;
    }

    const evsBody = {
      name,
      email,
      cpf: cpf || null,
      cnpj: cnpj || null,
    };

    const curlCommand = [
      "curl -X POST 'https://euviajoseguro.com.br/api/v3/clients/partial-register'",
      "-H 'Content-Type: application/json'",
      "-H 'Authorization: Bearer ****'",
      `-d '${JSON.stringify(evsBody)}'`,
    ].join(' \\\n  ');

    console.log('[evs-partial-register] Enviando dados para Eu Viajo Seguro', {
      productId,
      evsProductId,
      payload: evsBody,
      curl: curlCommand,
    });

    const resp = await fetch('https://euviajoseguro.com.br/api/v3/clients/partial-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(evsBody),
    });

    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = { raw: text };
    }

    console.log('[evs-partial-register] Resposta da Eu Viajo Seguro', {
      status: resp.status,
      statusText: resp.statusText,
      body: json,
    });

    if (!resp.ok) {
      return errorResponse({
        success: false,
        message: `Erro na chamada Eu Viajo Seguro: status ${resp.status}`,
        data: json,
      }, 502);
    }

    return success({
      success: true,
      message: 'Cliente parcial registrado com sucesso na Eu Viajo Seguro',
      data: json,
    }, 200);
  } catch (error) {
    console.error('[evs-partial-register] Erro inesperado:', error);
    return errorResponse({
      success: false,
      message: 'Erro ao chamar Eu Viajo Seguro',
      error: error.message,
    }, 500);
  }
};
