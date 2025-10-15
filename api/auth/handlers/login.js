const { CognitoIdentityProviderClient, InitiateAuthCommand, NotAuthorizedException } = require("@aws-sdk/client-cognito-identity-provider");
const { createResponse, preflight, getOrigin } = require('./cors');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return createResponse(400, { message: 'Email e senha são obrigatórios.' }, getOrigin(event));
    }

    // Modo desenvolvimento: mock de autenticação local sem Cognito
    if (process.env.MOCK_AUTH === 'true' || process.env.NODE_ENV === 'development') {
      const now = Math.floor(Date.now() / 1000);
      const oneHour = 3600;
      const payload = {
        AccessToken: `dev-access-token-${now}`,
        IdToken: `dev-id-token-${now}`,
        RefreshToken: `dev-refresh-token-${now}`,
        ExpiresIn: oneHour,
        TokenType: 'Bearer',
        email,
      };
      return createResponse(200, payload, getOrigin(event));
    }

    // Produção: autenticação real via Cognito
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID, // Será injetado pelo Serverless
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);

    return createResponse(200, response.AuthenticationResult, getOrigin(event));
  } catch (error) {
    console.error('Erro de autenticação:', error);
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
