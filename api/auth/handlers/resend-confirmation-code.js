const { CognitoIdentityProviderClient, ResendConfirmationCodeCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { createResponse, preflight, getOrigin } = require('./cors');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    if (!event.body) {
      return createResponse(400, { message: 'Corpo da requisição está vazio.' }, getOrigin(event));
    }
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const email = (body.email || '').trim();

    if (!email) {
      return createResponse(400, { message: 'Email é obrigatório.' }, getOrigin(event));
    }

    const command = new ResendConfirmationCodeCommand({
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
    });

    await cognitoClient.send(command);

    return createResponse(200, { message: 'Código de verificação reenviado para seu email.' }, getOrigin(event));
  } catch (error) {
    console.error('Erro ao reenviar código de confirmação:', error);
    if (error.name === 'UserNotFoundException') {
      return createResponse(404, { message: 'Usuário não encontrado.' }, getOrigin(event));
    }
    if (error.name === 'InvalidParameterException') {
      return createResponse(400, { message: 'Usuário já confirmado ou parâmetro inválido.' }, getOrigin(event));
    }
    if (error.name === 'LimitExceededException') {
      return createResponse(429, { message: 'Muitas tentativas. Aguarde alguns minutos antes de solicitar um novo código.' }, getOrigin(event));
    }
    return createResponse(500, { message: 'Erro ao reenviar código. Tente novamente.' }, getOrigin(event));
  }
};
