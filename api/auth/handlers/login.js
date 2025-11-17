const { CognitoIdentityProviderClient, InitiateAuthCommand, NotAuthorizedException } = require("@aws-sdk/client-cognito-identity-provider");
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

    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);

    // Usando a função createResponse para aplicar os headers CORS corretamente
    return createResponse(200, response.AuthenticationResult, getOrigin(event));
  } catch (error) {
    console.error('Erro de autenticação:', error);
    
    // Usando a função createResponse para aplicar os headers CORS corretamente
    return createResponse(
      error instanceof NotAuthorizedException ? 401 : 500,
      { 
        message: error instanceof NotAuthorizedException 
          ? 'Email ou senha incorretos' 
          : 'Erro ao autenticar usuário'
      },
      getOrigin(event)
    );
  }
};
