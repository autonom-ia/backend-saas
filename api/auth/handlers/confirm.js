const { CognitoIdentityProviderClient, ConfirmSignUpCommand, CodeMismatchException, ExpiredCodeException, UserNotFoundException } = require("@aws-sdk/client-cognito-identity-provider");
const { createResponse, preflight, getOrigin } = require('./cors');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  console.log('--- Iniciando processo de confirmação ---');
  console.log('Recebido event.body:', event.body);

  try {
    if (!event.body) {
      throw new Error('Corpo da requisição está vazio.');
    }
    const { email, confirmationCode } = JSON.parse(event.body);

    if (!email || !confirmationCode) {
      return createResponse(400, { message: 'Email e código de confirmação são obrigatórios.' }, getOrigin(event));
    }

    const command = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
    });

    await cognitoClient.send(command);

    return createResponse(200, { message: 'Conta confirmada com sucesso! Você já pode fazer login.' }, getOrigin(event));

  } catch (error) {
    if (error instanceof CodeMismatchException) {
      return createResponse(400, { message: 'Código de confirmação inválido.' }, getOrigin(event));
    } else if (error instanceof ExpiredCodeException) {
      return createResponse(400, { message: 'O código de confirmação expirou. Por favor, solicite um novo.' }, getOrigin(event));
    } else if (error instanceof UserNotFoundException) {
      return createResponse(404, { message: 'Usuário não encontrado.' }, getOrigin(event));
    } else {
      console.error('--- Erro Inesperado na Confirmação ---');
      console.error('Nome do Erro:', error.name);
      console.error('Mensagem do Erro:', error.message);
      console.error('Objeto de Erro Completo:', JSON.stringify(error, null, 2));
      return createResponse(500, { message: 'Ocorreu um erro ao confirmar a conta.', error: error.name }, getOrigin(event));
    }
  }
};
