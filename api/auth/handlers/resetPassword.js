const { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { createResponse, preflight, getOrigin } = require('./cors');

const client = new CognitoIdentityProviderClient({ region: process.env.REGION });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const { email, code, newPassword } = JSON.parse(event.body);

    if (!email || !code || !newPassword) {
      return createResponse(400, { message: 'Todos os campos são obrigatórios: e-mail, código e nova senha.' }, getOrigin(event));
    }

    const command = new ConfirmForgotPasswordCommand({
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    });

    await client.send(command);

    return createResponse(200, { message: 'Senha redefinida com sucesso.' }, getOrigin(event));
  } catch (error) {
    console.error('Erro ao redefinir a senha:', error);
    return createResponse(error.statusCode || 500, { message: error.message || 'Ocorreu um erro interno ao redefinir a sua senha.' }, getOrigin(event));
  }
};
