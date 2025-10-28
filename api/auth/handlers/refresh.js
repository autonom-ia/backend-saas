const { CognitoIdentityProviderClient, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { createResponse, preflight, getOrigin } = require('./cors');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }

  try {
    const origin = getOrigin(event);
    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { RefreshToken } = body || {};

    if (!RefreshToken) {
      return createResponse(400, { message: 'RefreshToken é obrigatório.' }, origin);
    }

    const params = {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: RefreshToken,
      },
    };

    const command = new InitiateAuthCommand(params);
    const response = await cognitoClient.send(command);

    // Cognito may omit RefreshToken on refresh; preserve the provided one for clients if needed
    const result = {
      ...response.AuthenticationResult,
      RefreshToken: response?.AuthenticationResult?.RefreshToken || RefreshToken,
    };

    return createResponse(200, result, origin);
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    const status = 401;
    return createResponse(status, { message: 'Falha ao renovar token' }, getOrigin(event));
  }
};
