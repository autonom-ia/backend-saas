const { getDbConnection } = require("../utils/database");

/**
 * Busca o perfil de administrador
 * @returns {Promise<Object|null>} Perfil de administrador ou null se não encontrado
 */
const getAdminProfile = async () => {
  const knex = getDbConnection();
  const adminProfile = await knex("access_profiles")
    .where({ admin: true })
    .first();
  return adminProfile;
};

/**
 * Busca um perfil de acesso pelo ID
 * @param {string} id - ID do perfil de acesso
 * @returns {Promise<Object|null>} Perfil de acesso encontrado ou null
 */
const getAccessProfileById = async (id) => {
  const knex = getDbConnection();
  const profile = await knex("access_profiles").where({ id }).first();
  return profile;
};

/**
 * Busca todos os perfis de acesso
 * @returns {Promise<Array>} Lista de perfis de acesso
 */
const getAllAccessProfiles = async () => {
  const knex = getDbConnection();
  return knex("access_profiles").select("*").orderBy("name", "asc");
};

module.exports = {
  getAdminProfile,
  getAccessProfileById,
  getAllAccessProfiles,
};
