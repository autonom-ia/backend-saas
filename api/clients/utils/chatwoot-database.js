const knex = require('knex');

function normalizePrefix(prefix) {
  return String(prefix || '').replace(/^\/+|\/+$/g, '');
}

function normalizeBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'sim'].includes(normalized);
}

function buildSslConfig(value) {
  return normalizeBoolean(value) ? { rejectUnauthorized: false } : false;
}

async function getAccountIdByPrefix(db, prefix) {
  const normalizedPrefix = normalizePrefix(prefix);

  let prefixParam = await db('account_parameter')
    .select('account_id')
    .where({ name: 'prefix-parameter', value: normalizedPrefix })
    .first();

  if (!prefixParam) {
    prefixParam = await db('account_parameter')
      .select('account_id')
      .where('name', 'prefix-parameter')
      .andWhere('value', 'like', `%${normalizedPrefix}%`)
      .first();
  }

  if (!prefixParam) {
    throw new Error(`Conta não encontrada para o prefixo '${normalizedPrefix}'`);
  }

  return prefixParam.account_id;
}

async function getAccountProductId(db, accountId) {
  if (!accountId) {
    return null;
  }

  const account = await db('account')
    .select('product_id')
    .where({ id: accountId })
    .first();

  return account?.product_id || null;
}

async function getAccountParameterValue(db, accountId, names) {
  if (!accountId) {
    return null;
  }

  const row = await db('account_parameter')
    .select('value')
    .where({ account_id: accountId })
    .whereIn('name', names)
    .first();

  return row?.value || null;
}

async function getProductParameterValue(db, productId, names) {
  if (!productId) {
    return null;
  }

  const row = await db('product_parameter')
    .select('value')
    .where({ product_id: productId })
    .whereIn('name', names)
    .first();

  return row?.value || null;
}

async function getParameterValue(db, options) {
  const {
    accountId,
    productId,
    names,
    envNames = [],
    defaultValue = null,
  } = options;

  const accountValue = await getAccountParameterValue(db, accountId, names);
  if (accountValue) {
    return accountValue;
  }

  const resolvedProductId = productId || await getAccountProductId(db, accountId);
  const productValue = await getProductParameterValue(db, resolvedProductId, names);
  if (productValue) {
    return productValue;
  }

  for (const envName of envNames) {
    if (process.env[envName]) {
      return process.env[envName];
    }
  }

  return defaultValue;
}

async function getChatwootDbConfig(db, options = {}) {
  const accountId = options.accountId;
  const productId = options.productId || null;

  const host = await getParameterValue(db, {
    accountId,
    productId,
    names: ['chatwoot_db_host', 'chatwoot-db-host', 'CHATWOOT_DB_HOST'],
    envNames: ['AUTONOMIA_CHATWOOT_DB_HOST', 'CHATWOOT_DB_HOST'],
  });

  if (!host) {
    throw new Error(`Parâmetro 'chatwoot_db_host' não encontrado para account_id=${accountId}`);
  }

  const port = await getParameterValue(db, {
    accountId,
    productId,
    names: ['chatwoot_db_port', 'chatwoot-db-port', 'CHATWOOT_DB_PORT'],
    envNames: ['AUTONOMIA_CHATWOOT_DB_PORT', 'CHATWOOT_DB_PORT'],
    defaultValue: '5432',
  });

  const database = await getParameterValue(db, {
    accountId,
    productId,
    names: ['chatwoot_db_name', 'chatwoot-db-name', 'CHATWOOT_DB_NAME'],
    envNames: ['AUTONOMIA_CHATWOOT_DB_NAME', 'CHATWOOT_DB_NAME'],
    defaultValue: 'chatwoot',
  });

  const user = await getParameterValue(db, {
    accountId,
    productId,
    names: ['chatwoot_db_user', 'chatwoot-db-user', 'CHATWOOT_DB_USER'],
    envNames: ['AUTONOMIA_CHATWOOT_DB_USER', 'CHATWOOT_DB_USER'],
    defaultValue: 'postgres',
  });

  const password = await getParameterValue(db, {
    accountId,
    productId,
    names: ['chatwoot_db_password', 'chatwoot-db-password', 'CHATWOOT_DB_PASSWORD'],
    envNames: ['AUTONOMIA_CHATWOOT_DB_PASSWORD', 'CHATWOOT_DB_PASSWORD'],
  });

  if (!password) {
    throw new Error(`Parâmetro 'chatwoot_db_password' não encontrado para account_id=${accountId}`);
  }

  const sslEnabled = await getParameterValue(db, {
    accountId,
    productId,
    names: ['chatwoot_db_ssl_enabled', 'chatwoot-db-ssl-enabled', 'CHATWOOT_DB_SSL_ENABLED'],
    envNames: ['AUTONOMIA_CHATWOOT_DB_SSL_ENABLED', 'CHATWOOT_DB_SSL_ENABLED'],
    defaultValue: 'false',
  });

  return {
    host,
    port: Number(port) || 5432,
    database,
    user,
    password,
    ssl: buildSslConfig(sslEnabled),
  };
}

async function createChatwootDbConnection(db, options = {}) {
  const config = await getChatwootDbConfig(db, options);

  console.log('[ChatwootDB] Conectando', {
    accountId: options.accountId || null,
    productId: options.productId || null,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: Boolean(config.ssl),
    password: '[REDACTED]',
  });

  const chatwootDb = knex({
    client: 'pg',
    connection: config,
    pool: { min: 0, max: options.poolMax || 2 },
    acquireConnectionTimeout: 10000,
  });

  await chatwootDb.raw('SELECT 1');
  return chatwootDb;
}

module.exports = {
  createChatwootDbConnection,
  getAccountIdByPrefix,
  getChatwootDbConfig,
  normalizePrefix,
};
