const { callCoparOnboarding } = require('../services/copar-service');
const { getDbConnection } = require('../utils/database');
const axios = require('axios');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const WEBHOOK_INGEST_URL = process.env.WEBHOOK_INGEST_URL || 'https://api-webhook.autonomia.site/webhooks';

let cachedWebhookToken = null;
let cachedWebhookTokenPromise = null;

const getWebhookApplicationToken = async () => {
  if (cachedWebhookToken) {
    return cachedWebhookToken;
  }

  if (cachedWebhookTokenPromise) {
    return cachedWebhookTokenPromise;
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const ssmClient = new SSMClient({ region });

  cachedWebhookTokenPromise = ssmClient
    .send(new GetParameterCommand({
      Name: '/webhook-service/prod/application-token',
      WithDecryption: true,
    }))
    .then((res) => {
      const value = res && res.Parameter && res.Parameter.Value ? res.Parameter.Value : '';
      cachedWebhookToken = value;
      return value;
    })
    .catch((err) => {
      console.error('[Copar Handler] Erro ao buscar token do webhook no SSM:', err);
      cachedWebhookToken = null;
      throw err;
    });

  return cachedWebhookTokenPromise;
};

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

    const contactId = body && body.contact_id ? String(body.contact_id).trim() : '';
    if (!contactId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ success: false, message: 'contact_id é obrigatório' }),
      };
    }

    const db = getDbConnection();

    const contactData = body.contact_data && typeof body.contact_data === 'object'
      ? body.contact_data
      : body;

    await db('contact')
      .where('id', contactId)
      .update({
        contact_data: contactData,
        updated_at: new Date(),
      });

    // Buscar user_session relacionada a este contato para obter o account_id
    let userSession = null;
    try {
      userSession = await db('user_session')
        .where('contact_id', contactId)
        .orderBy('created_at', 'desc')
        .first();
    } catch (sessionErr) {
      console.error('[Copar Handler] Erro ao buscar user_session por contact_id:', sessionErr);
    }

    if (userSession && userSession.account_id) {
      try {
        const applicationToken = await getWebhookApplicationToken();

        if (!applicationToken) {
          console.warn('[Copar Handler] Token de aplicação do webhook não encontrado. Webhook não será chamado.');
        } else {
          const webhookPayload = {
            accountId: userSession.account_id,
            entity: 'contact',
            action: 'update',
            payload: {
              ...body,
              contact_id: contactId,
            },
          };

          console.log('[Copar Handler] Enviando webhook de atualização de contato', {
            url: WEBHOOK_INGEST_URL,
            accountId: userSession.account_id,
            contactId,
          });

          await axios.post(WEBHOOK_INGEST_URL, webhookPayload, {
            headers: {
              'Content-Type': 'application/json',
              'x-application-token': applicationToken,
            },
          });
        }
      } catch (webhookErr) {
        console.error('[Copar Handler] Erro ao chamar webhook de contato:', webhookErr?.response?.data || webhookErr.message || webhookErr);
      }
    } else {
      console.warn('[Copar Handler] Nenhuma user_session encontrada para o contact_id. Webhook não será chamado.', {
        contactId,
      });
    }

    console.log('[Copar Handler] Body bruto recebido', event.body);

    console.log('[Copar Handler] Body parseado', body);

    console.log('[Copar Handler] Payload recebido (resumo)', {
      hasPdf: !!body.pdf_conta_luz,
      tipo: body.tipo,
      email: body.email,
      telefone: body.telefone,
      uuid_sessao: body.uuid_sessao,
      contact_id: contactId,
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
