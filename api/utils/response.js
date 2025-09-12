/**
 * Utilidades para formatar respostas HTTP das funções Lambda
 */

/**
 * Formata uma resposta de sucesso
 * @param {Object} body - Corpo da resposta
 * @param {number} statusCode - Código de status HTTP (default: 200)
 * @returns {Object} - Resposta formatada para API Gateway
 */
const success = (body, statusCode = 200) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body)
  };
};

/**
 * Formata uma resposta de erro
 * @param {string|Object} error - Mensagem de erro ou objeto de erro
 * @param {number} statusCode - Código de status HTTP (default: 500)
 * @returns {Object} - Resposta formatada para API Gateway
 */
const error = (error, statusCode = 500) => {
  const body = typeof error === 'string' 
    ? { message: error } 
    : (error.message ? { message: error.message, ...error } : error);
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body)
  };
};

module.exports = {
  success,
  error
};
