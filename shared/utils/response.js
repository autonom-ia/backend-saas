// Função auxiliar para criar respostas com os cabeçalhos de CORS corretos
const createResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      // Permitir múltiplos domínios para ambiente de desenvolvimento e produção
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
  };
};

module.exports = {
  createResponse
};
