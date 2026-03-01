const nodemailer = require('nodemailer');

/**
 * Cria um transporte SMTP usando variáveis de ambiente configuradas via SSM.
 */
function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT || '465';
  const secureFlag = process.env.SMTP_SECURE || 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Configuração SMTP inválida: verifique SMTP_HOST, SMTP_USER e SMTP_PASS');
  }

  const port = Number.parseInt(portValue, 10) || 465;
  const secure = secureFlag === 'true';

  const tlsRejectUnauthorizedFlag = process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true';
  const rejectUnauthorized = tlsRejectUnauthorizedFlag === 'true';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized,
    },
  });
}

async function sendInboxConnectionLinkEmail({ to, link, inboxName, contactName }) {
  if (!to) {
    throw new Error('Destinatário do e-mail é obrigatório');
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || 'Autonom.ia';
  const replyTo = process.env.SMTP_REPLY_TO || undefined;

  if (!fromEmail) {
    throw new Error('SMTP_FROM_EMAIL ou SMTP_USER não configurado');
  }

  const subject = 'Link para conexão do WhatsApp da sua caixa de entrada';
  const displayName = contactName || inboxName || 'sua caixa de entrada';

  const textBody = `Olá${contactName ? ` ${contactName}` : ''}!

Use o link abaixo para conectar o WhatsApp da caixa de entrada ${displayName}:

${link}

Se você não solicitou este link, pode ignorar esta mensagem.
`;

  const htmlBody = `<p>Olá${contactName ? ` ${contactName}` : ''}!</p>
<p>Use o link abaixo para conectar o WhatsApp da caixa de entrada <strong>${displayName}</strong>:</p>
<p><a href="${link}">${link}</a></p>
<p>Se você não solicitou este link, pode ignorar esta mensagem.</p>`;

  const transport = createSmtpTransport();

  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const mailOptions = {
    from: fromHeader,
    to,
    subject,
    text: textBody,
    html: htmlBody,
    replyTo,
  };

  await transport.sendMail(mailOptions);
}

module.exports = {
  sendInboxConnectionLinkEmail,
};
