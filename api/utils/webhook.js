const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const WEBHOOK_EVENTS_QUEUE_URL = process.env.WEBHOOK_EVENTS_QUEUE_URL || '';

const getWebhookApplicationToken = async () => {
  const token = process.env.WEBHOOK_APPLICATION_TOKEN || '';
  if (!token) {
    console.warn('[Webhook Utils] WEBHOOK_APPLICATION_TOKEN não está definido nas variáveis de ambiente.');
  }
  return token;
};

/**
 * Envia webhook de update de contato com base em um registro de kanban_items.
 * Inclui todos os campos do item no payload e acrescenta contact_id resolvido via user_session.
 * @param {import('knex')} db - Instância do Knex já conectada ao banco principal
 * @param {object} kanbanItem - Linha retornada de kanban_items (deve conter account_id e user_session_id)
 */
const sendContactWebhookForKanbanItem = async (db, kanbanItem) => {
  if (!kanbanItem) {
    return;
  }

  if (!kanbanItem.user_session_id) {
    console.warn('[Webhook Utils] kanban_item sem user_session_id, webhook não será enviado.', {
      kanbanItemId: kanbanItem.id,
    });
    return;
  }

  try {
    console.log('[Webhook Utils] Buscando user_session para kanban_item', {
      kanbanItemId: kanbanItem.id,
      user_session_id: kanbanItem.user_session_id,
    });

    const userSession = await db('user_session')
      .select('account_id', 'contact_id')
      .where('id', kanbanItem.user_session_id)
      .first();

    if (!userSession || !userSession.account_id || !userSession.contact_id) {
      console.warn('[Webhook Utils] user_session sem account_id ou contact_id, webhook não será enviado.', {
        kanbanItemId: kanbanItem.id,
        userSessionId: kanbanItem.user_session_id,
      });
      return;
    }

    const applicationToken = await getWebhookApplicationToken();

    if (!applicationToken) {
      console.warn('[Webhook Utils] Token de aplicação do webhook não encontrado. Webhook não será chamado.');
      return;
    }

    let contactData = null;
    let externalCode = null;
    try {
      const contactRow = await db('contact')
        .select('contact_data', 'external_code')
        .where('id', userSession.contact_id)
        .first();

      contactData = contactRow && contactRow.contact_data ? contactRow.contact_data : null;
      externalCode = contactRow && contactRow.external_code ? contactRow.external_code : null;
    } catch (contactErr) {
      console.warn('[Webhook Utils] Não foi possível carregar contact_data para o contato relacionado. Campo será enviado como null.', {
        contactId: userSession.contact_id,
        error: contactErr?.message || contactErr,
      });
    }

    let currentStep = null;
    if (kanbanItem.funnel_stage_id) {
      currentStep = await db('conversation_funnel_step')
        .select('name', 'kanban_code')
        .where('id', kanbanItem.funnel_stage_id)
        .first();
    }

    const changedAt = kanbanItem.updated_at || new Date().toISOString();

    const webhookPayload = {
      accountId: userSession.account_id,
      entity: 'kanban_items',
      action: 'update',
      payload: {
        ...kanbanItem,
        contact_id: userSession.contact_id,
        contact_data: contactData,
        external_code: externalCode,
        currentStepName: currentStep && currentStep.name ? currentStep.name : null,
        currentStepCode: currentStep && currentStep.kanban_code ? currentStep.kanban_code : null,
        changedAt,
      },
    };

    if (!WEBHOOK_EVENTS_QUEUE_URL) {
      console.warn('[Webhook Utils] WEBHOOK_EVENTS_QUEUE_URL não configurada. Evento não será enfileirado.');
      return;
    }

    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    console.log('[Webhook Utils] Enfileirando evento de webhook no SQS a partir de kanban_item', {
      queueUrl: WEBHOOK_EVENTS_QUEUE_URL,
      region,
      accountId: userSession.account_id,
      contactId: userSession.contact_id,
      kanbanItemId: kanbanItem.id,
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

    console.log('[Webhook Utils] Evento de webhook enfileirado com sucesso no SQS', {
      queueUrl: WEBHOOK_EVENTS_QUEUE_URL,
      durationMs: Date.now() - startedSqsAt,
    });
  } catch (err) {
    console.error('[Webhook Utils] Erro ao enviar webhook para kanban_item:', err?.response?.data || err.message || err);
  }
};

module.exports = {
  getWebhookApplicationToken,
  sendContactWebhookForKanbanItem,
};
