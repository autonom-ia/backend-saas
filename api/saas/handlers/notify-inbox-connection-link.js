const { success, error: errorResponse } = require('../utils/response');
const { withCors } = require('../utils/cors');
const { sendInboxConnectionLinkEmail } = require('../services/email-service');

// Esta função roda fora da VPC para poder acessar SMTP externo.
// Por isso, não deve depender de Redis ou banco de dados.
// Todos os dados necessários (link, e-mail de destino, nomes) devem vir do frontend.

exports.handler = withCors(async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const inboxId = pathParams.inboxId;

    if (!inboxId) {
      return errorResponse({ success: false, message: 'Parâmetro inboxId é obrigatório' }, 400, event);
    }

    const body = JSON.parse(event.body || '{}');
    const { link, override_email, notification_email, inbox_name, contact_name } = body;

    if (!link) {
      return errorResponse({ success: false, message: 'link é obrigatório' }, 400, event);
    }

    const to = override_email || notification_email;
    if (!to) {
      return errorResponse(
        { success: false, message: 'E-mail de destino é obrigatório (override_email ou notification_email)' },
        400,
        event,
      );
    }

    await sendInboxConnectionLinkEmail({
      to,
      link,
      inboxName: inbox_name || null,
      contactName: contact_name || null,
    });

    return success({ success: true }, 200, event);
  } catch (err) {
    console.error('Erro ao notificar link de conexão da inbox por e-mail:', err);
    return errorResponse({ success: false, message: 'Erro ao notificar link de conexão', error: err.message }, 500, event);
  }
});
