const { CognitoIdentityProviderClient, SignUpCommand, UsernameExistsException } = require("@aws-sdk/client-cognito-identity-provider");
const { createResponse, preflight, getOrigin } = require('./cors');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return createResponse(400, { message: 'Email e senha são obrigatórios.' }, getOrigin(event));
    }

    const command = new SignUpCommand({
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
      ],
    });

    await cognitoClient.send(command);

    return createResponse(201, {
      message: 'Usuário registrado com sucesso! Verifique seu e-mail para confirmar a conta.',
      needsEmailVerification: true,
    }, getOrigin(event));

  } catch (error) {
    if (error instanceof UsernameExistsException) {
   return createResponse(200, {
        message: 'Este e-mail já está cadastrado. Complete o cadastro no sistema para fazer login.',
        userAlreadyInCognito: true,
        needsEmailVerification: false,
      }, getOrigin(event));
    } else {
      console.error('Erro no registo:', error);
      return createResponse(500, { message: 'Ocorreu um erro ao registrar o usuário.' }, getOrigin(event));
    }
  }
};
