const { getDbConnection } = require('../utils/database');

const getAccountIntegrationApis = async (accountId, filters = {}) => {
  const knex = getDbConnection();
  const query = knex('account_integration_api').where('account_id', accountId);

  if (filters.isActive !== undefined) {
    query.andWhere('is_active', filters.isActive);
  }

  return query.orderBy('created_at', 'desc');
};

const createAccountIntegrationApi = async (accountId, payload) => {
  const knex = getDbConnection();

  const data = {
    account_id: accountId,
    name: payload.name,
    slug: payload.slug,
    description: payload.description ?? null,
    agent_instruction: payload.agent_instruction,
    base_url: payload.base_url,
    path_template: payload.path_template,
    http_method: payload.http_method,
    auth_type: payload.auth_type ?? null,
    auth_config: payload.auth_config ?? null,
    default_headers: payload.default_headers ?? null,
    default_query_params: payload.default_query_params ?? null,
    default_body_schema: payload.default_body_schema ?? null,
    is_active: payload.is_active !== undefined ? payload.is_active : true,
  };

  const [created] = await knex('account_integration_api').insert(data).returning('*');
  return created;
};

const getAccountIntegrationApiById = async (accountId, integrationApiId) => {
  const knex = getDbConnection();
  const item = await knex('account_integration_api')
    .where({ id: integrationApiId, account_id: accountId })
    .first();

  if (!item) {
    const error = new Error('Integração de API não encontrada para esta conta');
    error.statusCode = 404;
    throw error;
  }

  return item;
};

const updateAccountIntegrationApi = async (accountId, integrationApiId, payload) => {
  const knex = getDbConnection();

  await getAccountIntegrationApiById(accountId, integrationApiId);

  const updateData = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.slug !== undefined) updateData.slug = payload.slug;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.agent_instruction !== undefined) updateData.agent_instruction = payload.agent_instruction;
  if (payload.base_url !== undefined) updateData.base_url = payload.base_url;
  if (payload.path_template !== undefined) updateData.path_template = payload.path_template;
  if (payload.http_method !== undefined) updateData.http_method = payload.http_method;
  if (payload.auth_type !== undefined) updateData.auth_type = payload.auth_type;
  if (payload.auth_config !== undefined) updateData.auth_config = payload.auth_config;
  if (payload.default_headers !== undefined) updateData.default_headers = payload.default_headers;
  if (payload.default_query_params !== undefined) updateData.default_query_params = payload.default_query_params;
  if (payload.default_body_schema !== undefined) updateData.default_body_schema = payload.default_body_schema;
  if (payload.is_active !== undefined) updateData.is_active = payload.is_active;

  const [updated] = await knex('account_integration_api')
    .where({ id: integrationApiId, account_id: accountId })
    .update(updateData)
    .returning('*');

  return updated;
};

const updateAccountIntegrationApiStatus = async (accountId, integrationApiId, isActive) => {
  return updateAccountIntegrationApi(accountId, integrationApiId, { is_active: isActive });
};

module.exports = {
  getAccountIntegrationApis,
  createAccountIntegrationApi,
  getAccountIntegrationApiById,
  updateAccountIntegrationApi,
  updateAccountIntegrationApiStatus,
};
