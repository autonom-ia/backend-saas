const { CognitoIdentityProviderClient, ForgotPasswordCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { createResponse, preflight, getOrigin } = require('./cors');

const client = new CognitoIdentityProviderClient({ region: process.env.REGION });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return createResponse(400, { message: 'O e-mail é obrigatório.' }, getOrigin(event));
    }

    const command = new ForgotPasswordCommand({
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
    });

    await client.send(command);

    return createResponse(200, { message: 'Se o e-mail estiver registado, um código de recuperação foi enviado.' }, getOrigin(event));
  } catch (error) {
    console.error('Erro ao solicitar recuperação de senha:', error);

    // O Cognito retorna um erro 'UserNotFoundException' se o e-mail não existir.
    // Por segurança, não informamos ao cliente se o usuário existe ou não.
    // A mensagem de sucesso é retornada em ambos os casos para evitar a enumeração de usuários.
    if (error.name === 'UserNotFoundException') {
      return createResponse(200, { message: 'Se o e-mail estiver registado, um código de recuperação foi enviado.' }, getOrigin(event));
    }

    return createResponse(error.statusCode || 500, { message: error.message || 'Ocorreu um erro interno ao processar a sua solicitação.' }, getOrigin(event));
  }
};
