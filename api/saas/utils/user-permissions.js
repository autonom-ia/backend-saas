const { getUserPermissions } = require('../services/user-company-service');

/**
 * Extrai o userId do header x-user-id
 * @param {Object} event - Evento do Lambda
 * @returns {string|null} userId ou null
 */
const extractUserIdFromHeader = (event) => {
  const headers = event?.headers || {};
  const userId = headers['x-user-id'] || headers['X-User-Id'];
  return userId || null;
};

/**
 * Valida se o userId foi fornecido no header
 * Retorna erro genérico de autorização para não expor detalhes de segurança
 * @param {string|null} userId - userId extraído do header
 * @returns {Object|null} Objeto de erro ou null se válido
 */
const validateUserId = (userId) => {
  if (!userId) {
    return {
      success: false,
      message: 'Não autorizado'
    };
  }
  return null;
};

/**
 * Busca permissões do usuário a partir do header
 * @param {Object} event - Evento do Lambda
 * @returns {Promise<Object>} Permissões do usuário
 */
const getUserPermissionsFromHeader = async (event) => {
  const userId = extractUserIdFromHeader(event);
  const validationError = validateUserId(userId);
  
  if (validationError) {
    throw new Error('Não autorizado');
  }
  
  return getUserPermissions(userId);
};

module.exports = {
  extractUserIdFromHeader,
  validateUserId,
  getUserPermissionsFromHeader,
  getUserPermissions
};
