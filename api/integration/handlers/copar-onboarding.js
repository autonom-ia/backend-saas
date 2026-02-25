const { callCoparOnboarding } = require('../services/copar-service');
const { getDbConnection } = require('../utils/database');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const WEBHOOK_EVENTS_QUEUE_URL = process.env.WEBHOOK_EVENTS_QUEUE_URL || '';

const getWebhookApplicationToken = async () => {
  const token = process.env.WEBHOOK_APPLICATION_TOKEN || '';
  if (!token) {
    console.warn('[Copar Handler] WEBHOOK_APPLICATION_TOKEN não está definido nas variáveis de ambiente.');
  }
  return token;
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
          console.warn('[Copar Handler] Token de aplicação do webhook não encontrado. Evento não será enfileirado.');
        } else if (!WEBHOOK_EVENTS_QUEUE_URL) {
          console.warn('[Copar Handler] WEBHOOK_EVENTS_QUEUE_URL não configurada. Evento não será enfileirado.');
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

          const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
          console.log('[Copar Handler] Enfileirando evento de webhook de atualização de contato no SQS', {
            queueUrl: WEBHOOK_EVENTS_QUEUE_URL,
            region,
            accountId: userSession.account_id,
            contactId,
            entity: webhookPayload.entity,
            action: webhookPayload.action,
          });

          const sqs = new SQSClient({ region });
          const queueMessageBody = {
            accountId: webhookPayload.accountId,
            entity: webhookPayload.entity,
            action: webhookPayload.action,
            payload: webhookPayload.payload,
          };

          const startedSqsAt = Date.now();
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: WEBHOOK_EVENTS_QUEUE_URL,
              MessageBody: JSON.stringify(queueMessageBody),
            })
          );

          console.log('[Copar Handler] Evento de webhook de contato enfileirado com sucesso no SQS', {
            queueUrl: WEBHOOK_EVENTS_QUEUE_URL,
            durationMs: Date.now() - startedSqsAt,
          });
        }
      } catch (webhookErr) {
        console.error('[Copar Handler] Erro ao enfileirar webhook de contato:', webhookErr?.response?.data || webhookErr.message || webhookErr);
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
