const { getDbConnection } = require('../utils/database');

const ADMIN_AUTONOMIA_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';
const ADMIN_CLIENTE_PROFILE_ID = 'e8cbb607-4a3a-44c6-8669-a5c6d2bd5e17';
const AUTONOMIA_DOMAIN = '/autonomia';

/**
 * Busca o company_id do usuário através do relacionamento user_company
 * @param {Object} knex - Instância do Knex
 * @param {string} userId - ID do usuário
 * @returns {Promise<string|null>} ID da company ou null
 */
const getUserCompanyId = async (knex, userId) => {
  const userCompany = await knex('user_company')
    .where({ user_id: userId })
    .select('company_id')
    .first();
  
  if (!userCompany) {
    return null;
  }
  
  return userCompany.company_id;
};

/**
 * Busca o domain da company do usuário através do relacionamento user_company -> company
 * @param {Object} knex - Instância do Knex
 * @param {string} userId - ID do usuário
 * @returns {Promise<string|null>} Domain da company ou null
 */
const getUserCompanyDomain = async (knex, userId) => {
  const userCompany = await knex('user_company')
    .where({ user_id: userId })
    .join('company', 'user_company.company_id', 'company.id')
    .select('company.domain')
    .first();
  
  if (!userCompany) {
    return null;
  }
  
  return userCompany.domain;
};

/**
 * Verifica se o usuário é admin autonomia através do relacionamento user_access_profiles
 * @param {Object} knex - Instância do Knex
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} true se for admin autonomia
 */
const checkIsAdminAutonomia = async (knex, userId) => {
  const userProfiles = await knex('user_access_profiles')
    .where({ user_id: userId })
    .pluck('access_profile_id');
  
  return Array.isArray(userProfiles) && userProfiles.includes(ADMIN_AUTONOMIA_PROFILE_ID);
};

/**
 * Verifica se o usuário é admin (autonomia ou cliente) através do relacionamento user_access_profiles
 * @param {Object} knex - Instância do Knex
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} true se for admin
 */
const checkIsAdmin = async (knex, userId) => {
  const userProfiles = await knex('user_access_profiles')
    .where({ user_id: userId })
    .pluck('access_profile_id');
  
  const isAdminAutonomia = Array.isArray(userProfiles) && userProfiles.includes(ADMIN_AUTONOMIA_PROFILE_ID);
  const isAdminCliente = Array.isArray(userProfiles) && userProfiles.includes(ADMIN_CLIENTE_PROFILE_ID);
  
  return isAdminAutonomia || isAdminCliente;
};

/**
 * Verifica se o domain é da company autonomia
 * @param {string} domain - Domain da company
 * @returns {boolean} true se for autonomia
 */
const isAutonomiaDomain = (domain) => {
  return domain === AUTONOMIA_DOMAIN;
};

/**
 * Busca todas as informações de permissão do usuário
 * Aproveita os relacionamentos: user_company -> company e user_access_profiles
 * Regra: Administrador Autonomia pode ver tudo, independente da company
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Objeto com isAdmin, isAdminAutonomia, companyId, companyDomain, isAutonomia, canSeeAll
 */
const getUserPermissions = async (userId) => {
  const knex = getDbConnection();
  
  const [isAdminAutonomia, isAdmin, companyId, companyDomain] = await Promise.all([
    checkIsAdminAutonomia(knex, userId),
    checkIsAdmin(knex, userId),
    getUserCompanyId(knex, userId),
    getUserCompanyDomain(knex, userId)
  ]);
  
  const isAutonomia = isAutonomiaDomain(companyDomain);
  // Administrador Autonomia pode ver tudo, independente da company
  const canSeeAll = isAdminAutonomia;
  
  return {
    isAdmin,
    isAdminAutonomia,
    companyId,
    companyDomain,
    isAutonomia,
    canSeeAll
  };
};

/**
 * Valida se o usuário tem acesso a uma company específica
 * @param {Object} knex - Instância do Knex
 * @param {string} userId - ID do usuário
 * @param {string} companyId - ID da company a validar
 * @param {boolean} canSeeAll - Se o usuário pode ver todas as companies
 * @returns {Promise<boolean>} true se tiver acesso
 */
const hasCompanyAccess = async (knex, userId, companyId, canSeeAll) => {
  if (canSeeAll) {
    return true;
  }
  
  const userCompanyId = await getUserCompanyId(knex, userId);
  return userCompanyId === companyId;
};

/**
 * Valida se o usuário tem acesso a um domain específico
 * @param {Object} knex - Instância do Knex
 * @param {string} userId - ID do usuário
 * @param {string} domain - Domain a validar
 * @param {boolean} canSeeAll - Se o usuário pode ver todas as companies
 * @returns {Promise<boolean>} true se tiver acesso
 */
const hasDomainAccess = async (knex, userId, domain, canSeeAll) => {
  if (canSeeAll) {
    return true;
  }
  
  const userCompanyDomain = await getUserCompanyDomain(knex, userId);
  return userCompanyDomain === domain;
};

module.exports = {
  getUserCompanyId,
  getUserCompanyDomain,
  checkIsAdmin,
  checkIsAdminAutonomia,
  isAutonomiaDomain,
  getUserPermissions,
  hasCompanyAccess,
  hasDomainAccess
};
