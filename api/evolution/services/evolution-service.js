const axios = require('axios');
const { getDbConnection } = require('../utils/database');
const { formatParameters } = require('../utils/format-parameters');
const knex = require('knex');

// Util para mascarar chaves sensíveis nos logs
function mask(value) {
  try {
    const str = String(value || '');
    if (str.length <= 8) return '****';
    return `${str.slice(0, 4)}****${str.slice(-4)}`;
  } catch {
    return '****';
  }
}

// ================= Helpers: Chatwoot DB connection via SSM envs (replicates clients service) =================
async function getAccountPrefix(db, accountId) {
  // Busca o parâmetro "prefix-parameter" para determinar o prefixo de SSM/env
  const row = await db('account_parameter')
    .select('value')
    .where({ account_id: accountId, name: 'prefix-parameter' })
    .first();
  if (!row || !row.value) {
    throw new Error('Parâmetro prefix-parameter não encontrado para a conta');
  }
  return row.value; // ex: "/autonomia/chatwoot/db" ou "/empresta/chatwoot/db"
}

async function createChatwootDbConnection(prefix) {
  try {
    console.log(`[ChatwootDB] Buscando parâmetros de conexão (prefixo: ${prefix})`);
    // Ex.: prefix '/autonomia/chatwoot/db' => envPrefix 'AUTONOMIA'
    const envPrefix = prefix.replace(/^\/|\/$/g, '').split('/')[0].toUpperCase();
    const hostVarName = `${envPrefix}_CHATWOOT_DB_HOST`;
    const nameVarName = `${envPrefix}_CHATWOOT_DB_NAME`;
    const passwordVarName = `${envPrefix}_CHATWOOT_DB_PASSWORD`;
    const portVarName = `${envPrefix}_CHATWOOT_DB_PORT`;
    const userVarName = `${envPrefix}_CHATWOOT_DB_USER`;

    const host = process.env[hostVarName];
    const name = process.env[nameVarName];
    const password = process.env[passwordVarName];
    const port = process.env[portVarName];
    const user = process.env[userVarName];

    const missingEnvVars = [];
    if (!host) missingEnvVars.push(hostVarName);
    if (!name) missingEnvVars.push(nameVarName);
    if (!password) missingEnvVars.push(passwordVarName);
    if (!port) missingEnvVars.push(portVarName);
    if (!user) missingEnvVars.push(userVarName);
    if (missingEnvVars.length > 0) {
      throw new Error(`Variáveis de ambiente não encontradas: ${missingEnvVars.join(', ')}`);
    }

    console.log('[ChatwootDB] Conectando', { host, name, port, user, password: '[REDACTED]' });
    const chatwootDb = knex({
      client: 'pg',
      connection: { host, port, user, password, database: name },
      pool: { min: 0, max: 1 },
      acquireConnectionTimeout: 10000,
    });
    await chatwootDb.raw('SELECT 1');
    console.log('[ChatwootDB] Conexão OK');
    return chatwootDb;
  } catch (err) {
    console.error('[ChatwootDB] Erro ao conectar', err);
    throw err;
  }
}

async function getEvolutionConfig(domain) {
  if (!domain) throw new Error('Domain é obrigatório');

  const cacheKey = `evo-config:${domain}`; // cache desabilitado

  const db = getDbConnection();
  // 1) Buscar account pelo domain
  const account = await db('account').where({ domain }).first();
  if (!account) {
    throw new Error(`Conta não encontrada para domain: ${domain}`);
  }

  // 2) Buscar parâmetros da conta
  const paramsRows = await db('account_parameter')
    .where('account_id', account.id)
    .select('name', 'value');

  const params = formatParameters(paramsRows);
  const apiUrl = params['evo-url'] || params['evolution-url'] || params['EVOLUTION_URL'];
  const apiKey = params['api-key-evolution'] || params['evolution-apikey'] || params['EVOLUTION_API_KEY'];

  if (!apiUrl || !apiKey) {
    throw new Error('Parâmetros evo-url e/ou api-key-evolution não configurados para a conta');
  }

  // Sanitização do apiKey para evitar caracteres inválidos em header (CR, LF, etc)
  const sanitizedApiKey = String(apiKey)
    .replace(/[\r\n\t\v\f]/g, '')
    .trim();

  if (sanitizedApiKey !== apiKey) {
    console.warn('[Evolution] apiKey sanitizado (removidos caracteres de controle) ', {
      domain,
      beforePreview: mask(apiKey),
      afterPreview: mask(sanitizedApiKey),
    });
  }

  const config = { apiUrl, apiKey: sanitizedApiKey };
  console.log('[Evolution] Config carregada', {
    domain,
    apiUrl,
    apiKeyPreview: mask(sanitizedApiKey),
  });
  return config;
}

async function getClient(domain) {
  const { apiUrl, apiKey } = await getEvolutionConfig(domain);
  const client = axios.create({ baseURL: apiUrl, timeout: 20000 });
  client.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers['apikey'] = apiKey;
    console.log('[Evolution] Preparando request', {
      baseURL: config.baseURL || apiUrl,
      url: config.url,
      method: config.method,
      headers: {
        apikeyPreview: mask(apiKey),
      },
    });
    return config;
  });
  console.log('[Evolution] Axios client criado', { baseURL: apiUrl, apiKeyPreview: mask(apiKey) });
  return client;
}

async function createInstance(domain, payload) {
  const client = await getClient(domain);
  // Log sanitizado do payload enviado à Evolution para auditoria
  try {
    const prev = {
      instanceName: payload?.instanceName,
      integration: payload?.integration,
      qrcode: payload?.qrcode,
      groups_ignore: payload?.groups_ignore,
      groupsIgnore: payload?.groupsIgnore,
      always_online: payload?.always_online,
      alwaysOnline: payload?.alwaysOnline,
      // Chatwoot fields for verification
      syncFullHistory: payload?.syncFullHistory,
      chatwootAccountId: payload?.chatwootAccountId,
      chatwootTokenPreview: payload?.chatwootToken ? String(payload.chatwootToken).slice(0,4) + '****' : undefined,
      chatwootUrl: payload?.chatwootUrl,
      chatwootSignMsg: payload?.chatwootSignMsg,
      chatwootReopenConversation: payload?.chatwootReopenConversation,
      chatwootConversationPending: payload?.chatwootConversationPending,
      chatwootImportContacts: payload?.chatwootImportContacts,
      chatwootNameInbox: payload?.chatwootNameInbox,
      chatwootMergeBrazilContacts: payload?.chatwootMergeBrazilContacts,
      chatwootImportMessages: payload?.chatwootImportMessages,
      chatwootDaysLimitImportMessages: payload?.chatwootDaysLimitImportMessages,
      chatwootOrganization: payload?.chatwootOrganization,
      autoCreate: payload?.autoCreate,
      numberPreview: payload?.number ? String(payload.number).replace(/.(?=.{4})/g, '*') : undefined,
      tokenPreview: payload?.token ? String(payload.token).slice(0, 4) + '****' : undefined,
    };
    console.log('[EvolutionService.createInstance] Enviando payload', { domain, url: client.defaults.baseURL + '/instance/create', payload: prev });
  } catch {}
  const { data } = await client.post('/instance/create', payload);
  return data;
}

async function setChatwoot(domain, instance, payload) {
  const client = await getClient(domain);
  const { data } = await client.post(`/chatwoot/set/${encodeURIComponent(instance)}`, payload);
  return data;
}

async function connect(domain, instance, number) {
  const client = await getClient(domain);
  const params = {};
  if (number) params.number = number;
  const { data } = await client.get(`/instance/connect/${encodeURIComponent(instance)}`, { params });
  return data; // { pairingCode, code, count }
}

async function connectionState(domain, instance) {
  const client = await getClient(domain);
  const path = `/instance/connectionState/${encodeURIComponent(instance)}`;
  console.log('[Evolution] Chamando connectionState', { domain, instance, path });
  const { data } = await client.get(path);
  return data; // { instance: { instanceName, state } }
}

async function deleteInstance(domain, instance) {
  const client = await getClient(domain);
  const path = `/instance/delete/${encodeURIComponent(instance)}`;
  console.log('[Evolution] Deletando instância', { domain, instance, path });
  const { data } = await client.delete(path);
  return data;
}

module.exports = { createInstance, setChatwoot, connect, connectionState, deleteInstance };

// ================= Chatwoot Provisioning =================
async function provisionChatwoot(domain) {
  // Busca account e parâmetros
  const db = getDbConnection();
  const account = await db('account').where({ domain }).first();
  if (!account) throw new Error(`Conta não encontrada para domain: ${domain}`);
  const paramsRows = await db('account_parameter')
    .where('account_id', account.id)
    .select('name', 'value');
  const params = formatParameters(paramsRows);
  const chatwootUrl = params['chatwoot-url'] || params['CHATWOOT_URL'];
  const chatwootToken = params['chatwoot-token'] || params['CHATWOOT_TOKEN'];
  if (!chatwootUrl || !chatwootToken) {
    throw new Error('Parâmetros chatwoot-url e/ou chatwoot-token não configurados para a conta');
  }

  // Token de plataforma para endpoints "/platform" (prioriza parâmetro da conta)
  const platformTokenRaw = (
    params['chatwoot-platform-token'] ||
    params['CHATWOOT_PLATFORM_TOKEN'] ||
    process.env.CHATWOOT_PLATFORM_TOKEN ||
    'h5Gj43DZYb5HnY75gpGwUE3T'
  );
  const platformToken = String(platformTokenRaw).replace(/[\r\n\t\v\f]/g, '').trim();
  if (platformToken !== platformTokenRaw) {
    console.warn('[Chatwoot] platform token sanitizado (removidos caracteres de controle)', {
      domain,
      beforePreview: mask(platformTokenRaw),
      afterPreview: mask(platformToken),
    });
  }

  // Para endpoints que contenham "/platform" usar api_access_token obtido
  const cw = axios.create({ baseURL: chatwootUrl, timeout: 20000, headers: { api_access_token: platformToken } });
  console.log('[Chatwoot] Provision start', { domain, url: chatwootUrl, tokenPreview: mask(chatwootToken), platformTokenPreview: mask(platformToken) });

  // 1) Criar conta
  const accBody = { name: account.name || account.domain, locale: 'pt_BR' };
  const { data: accResp } = await cw.post('/platform/api/v1/accounts', accBody);
  const chatwootAccountId = accResp?.id || accResp?.data?.id;
  if (!chatwootAccountId) throw new Error('Falha ao criar conta no Chatwoot: ID ausente na resposta');

  // upsert em account_parameter: chatwoot-account
  const existingParam = await db('account_parameter').where({ account_id: account.id, name: 'chatwoot-account' }).first();
  if (existingParam) {
    await db('account_parameter').where({ id: existingParam.id }).update({ value: String(chatwootAccountId) });
  } else {
    await db('account_parameter').insert({ account_id: account.id, name: 'chatwoot-account', value: String(chatwootAccountId) });
  }

  // 2) Criar usuário
  const userBody = {
    name: account.name || account.domain,
    email: account.email,
    password: `${account.domain}@utonom1A2025`,
  };
  const { data: userResp } = await cw.post('/platform/api/v1/users', userBody);
  const userId = userResp?.id || userResp?.data?.id;
  if (!userId) throw new Error('Falha ao criar usuário no Chatwoot: user_id ausente');

  // 3) Associar usuário à conta como admin
  const assocBody = { user_id: userId, role: 'administrator' };
  await cw.post(`/platform/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}/account_users`, assocBody);

  // 3.1) Também associar o usuário com id=1 como administrador, conforme solicitado
  try {
    await cw.post(`/platform/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}/account_users`, { user_id: 1, role: 'administrator' });
  } catch (e) {
    console.warn('[Chatwoot] Falha ao associar user_id=1', { chatwootAccountId, error: e?.message || e });
  }

  console.log('[Chatwoot] Provisioned', { domain, chatwootAccountId });
  return { chatwootAccountId, chatwootToken: String(chatwootToken).trim(), chatwootUrl };
}

module.exports.provisionChatwoot = provisionChatwoot;

// ================= Chatwoot post-instance configuration =================
/**
 * Cria Agent Bot, associa à Inbox e salva parâmetro chatwoot-inbox.
 * @param {string} domain
 * @param {string} instanceName Nome da instância (usado como nome da inbox)
 */
async function configureChatwootInbox(domain, instanceName) {
  const db = getDbConnection();
  if (!domain) throw new Error('Domain é obrigatório');
  if (!instanceName) throw new Error('instanceName é obrigatório');

  // Buscar account e parâmetros
  const account = await db('account').where({ domain }).first();
  if (!account) throw new Error(`Conta não encontrada para domain: ${domain}`);
  const paramsRows = await db('account_parameter')
    .where('account_id', account.id)
    .select('name', 'value');
  const aparams = formatParameters(paramsRows);
  const chatwootUrl = aparams['chatwoot-url'] || aparams['CHATWOOT_URL'];
  const chatwootToken = aparams['chatwoot-token'] || aparams['CHATWOOT_TOKEN'];
  const chatwootAccountId = aparams['chatwoot-account'] || aparams['CHATWOOT_ACCOUNT'];
  if (!chatwootUrl || !chatwootToken || !chatwootAccountId) {
    throw new Error('Parâmetros chatwoot-url, chatwoot-token e/ou chatwoot-account ausentes');
  }

  // Buscar parâmetros do produto para obter agent_webhook
  let agentWebhook;
  if (account.product_id) {
    const prodParamsRows = await db('product_parameter')
      .where('product_id', account.product_id)
      .select('name', 'value');
    const pparams = formatParameters(prodParamsRows);
    agentWebhook = pparams['agent_webhook'] || pparams['agent-webhook'] || pparams['AGENT_WEBHOOK'];
  }

  const cw = axios.create({ baseURL: chatwootUrl, timeout: 20000, headers: { api_access_token: String(chatwootToken).trim() } });

  // 0) Atualizar feature_flags na tabela accounts do Chatwoot antes de criar o Agent Bot
  //    e manter a mesma conexão para consultar a inbox por SELECT
  let chatwootDb;
  try {
    const prefix = await getAccountPrefix(db, account.id);
    chatwootDb = await createChatwootDbConnection(prefix);
    console.log('[Chatwoot] Atualizando feature_flags na conta', { chatwootAccountId });
    await chatwootDb.raw('UPDATE accounts SET feature_flags = ? WHERE id = ?', [1099243192319, chatwootAccountId]);
    console.log('[Chatwoot] feature_flags atualizado com sucesso');
  } catch (e) {
    console.warn('[Chatwoot] Não foi possível atualizar feature_flags antes do Agent Bot', { error: e?.message || e });
    // seguir sem interromper o fluxo
  }

  // 1) Criar Agent Bot
  const botBody = {
    name: account.name || account.domain,
    description: 'Agente conversacional',
    outgoing_url: agentWebhook || '',
    bot_type: 0,
    bot_config: {},
  };
  let botId;
  try {
    const { data: botResp } = await cw.post(`/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}/agent_bots`, botBody);
    botId = botResp?.id || botResp?.data?.id;
    if (!botId) throw new Error('Resposta sem id do Agent Bot');
  } catch (e) {
    console.error('[Chatwoot] Falha ao criar Agent Bot', { error: e?.response?.data || e?.message || e });
    throw e;
  }

  // 2) Obter inbox id via SELECT no banco do Chatwoot usando a mesma conexão
  let inboxId;
  try {
    if (!chatwootDb) throw new Error('Conexão Chatwoot DB indisponível');
    const row = await chatwootDb('inboxes')
      .select('id')
      .where({ account_id: chatwootAccountId, name: String(instanceName).trim() })
      .first();
    console.log('[Chatwoot] Inbox select debug', {
      instanceName,
      chatwootAccountId,
      found: !!row,
      inboxId: row?.id,
    });
    inboxId = row?.id;
  } catch (e) {
    console.error('[Chatwoot] Falha ao consultar inbox via SELECT', { error: e?.message || e });
  } finally {
    try { if (chatwootDb) await chatwootDb.destroy(); } catch {}
  }
  if (!inboxId) throw new Error(`Inbox não encontrada para nome: ${instanceName}`);

  // 2.1) Associar Agent Bot à inbox
  try {
    await cw.post(`/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}/inboxes/${encodeURIComponent(inboxId)}/set_agent_bot`, { agent_bot: botId });
  } catch (e) {
    console.error('[Chatwoot] Falha ao associar Agent Bot à inbox', { inboxId, botId, error: e?.response?.data || e?.message || e });
    throw e;
  }

  // 3) Salvar parâmetro chatwoot-inbox com o inboxId
  const existing = await db('account_parameter').where({ account_id: account.id, name: 'chatwoot-inbox' }).first();
  if (existing) {
    await db('account_parameter').where({ id: existing.id }).update({ value: String(inboxId) });
  } else {
    await db('account_parameter').insert({ account_id: account.id, name: 'chatwoot-inbox', value: String(inboxId) });
  }

  console.log('[Chatwoot] Agent Bot criado e associado à inbox', { domain, chatwootAccountId, botId, inboxId, instanceName });
  return { botId, inboxId };
}

module.exports.configureChatwootInbox = configureChatwootInbox;
