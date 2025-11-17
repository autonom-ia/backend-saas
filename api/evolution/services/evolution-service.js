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

// ================= Helpers: Chatwoot DB connection via account_parameter (no SSM) =================

// Helper para buscar parâmetro com fallback: account_parameter → product_parameter
async function getParameterValue(accountId, paramName, options = {}) {
  const db = getDbConnection();
  const { required = false, aliases = [] } = options;
  
  // 1. Buscar na account primeiro
  const account = await db('account').where({ id: accountId }).first();
  if (!account) {
    throw new Error(`Conta não encontrada: ${accountId}`);
  }
  
  // Tentar todas as variações do nome do parâmetro
  const allNames = [paramName, ...aliases];
  
  // 2. Tentar account_parameter
  for (const name of allNames) {
    const accountParam = await db('account_parameter')
      .select('value')
      .where({ account_id: accountId, name })
      .first();
    
    if (accountParam && accountParam.value && String(accountParam.value).trim()) {
      console.log(`[getParameterValue] Encontrado em account_parameter: ${paramName} (alias: ${name})`);
      return String(accountParam.value).trim();
    }
  }
  
  // 3. Se não encontrou em account, buscar em product_parameter
  if (account.product_id) {
    for (const name of allNames) {
      const productParam = await db('product_parameter')
        .select('value')
        .where({ product_id: account.product_id, name })
        .first();
      
      if (productParam && productParam.value && String(productParam.value).trim()) {
        console.log(`[getParameterValue] Encontrado em product_parameter (fallback): ${paramName} (alias: ${name})`);
        return String(productParam.value).trim();
      }
    }
  }
  
  // 4. Se obrigatório e não encontrou, lançar erro
  if (required) {
    throw new Error(`Parâmetro obrigatório não encontrado: ${paramName} (aliases: ${aliases.join(', ')})`);
  }
  
  console.log(`[getParameterValue] Parâmetro não encontrado: ${paramName}`);
  return null;
}

async function createChatwootDbConnection(accountId) {
  try {
    if (!accountId) {
      throw new Error('accountId é obrigatório');
    }

    const db = getDbConnection();
    const account = await db('account').where({ id: accountId }).first();
    if (!account) {
      throw new Error(`Conta não encontrada para accountId: ${accountId}`);
    }

    // Buscar host do Chatwoot DB com fallback para product_parameter
    const host = await getParameterValue(accountId, 'chatwoot_db_host', { 
      required: true,
      aliases: ['chatwoot-db-host', 'CHATWOOT_DB_HOST']
    });
    const port = 5432;
    const user = 'postgres';
    const database = 'chatwoot';
    const password = 'Mfcd62!!Mfcd62!!';

    console.log('[ChatwootDB] Conectando', { accountId, host, database, port, user, password: '[REDACTED]' });
    const chatwootDb = knex({
      client: 'pg',
      connection: { host, port, user, password, database },
      pool: { min: 0, max: 1 },
      acquireConnectionTimeout: 10000,
    });
    await chatwootDb.raw('SELECT 1');
    console.log('[ChatwootDB] Conexão OK', { accountId });
    return chatwootDb;
  } catch (err) {
    console.error('[ChatwootDB] Erro ao conectar', { accountId, error: err.message });
    throw err;
  }
}

async function getEvolutionConfig(accountId) {
  if (!accountId) throw new Error('account_id é obrigatório');

  const cacheKey = `evo-config:${accountId}`; // cache desabilitado

  // Buscar parâmetros com fallback para product_parameter
  const apiUrl = await getParameterValue(accountId, 'evo-url', {
    required: true,
    aliases: ['evolution-url', 'EVOLUTION_URL']
  });
  
  const apiKey = await getParameterValue(accountId, 'api-key-evolution', {
    required: true,
    aliases: ['evolution-apikey', 'EVOLUTION_API_KEY']
  });

  // Sanitização do apiKey para evitar caracteres inválidos em header (CR, LF, etc)
  const sanitizedApiKey = String(apiKey)
    .replace(/[\r\n\t\v\f]/g, '')
    .trim();

  if (sanitizedApiKey !== apiKey) {
    console.warn('[Evolution] apiKey sanitizado (removidos caracteres de controle) ', {
      accountId,
      beforePreview: mask(apiKey),
      afterPreview: mask(sanitizedApiKey),
    });
  }

  const config = { apiUrl, apiKey: sanitizedApiKey };
  console.log('[Evolution] Config carregada', {
    accountId,
    apiUrl,
    apiKeyPreview: mask(sanitizedApiKey),
  });
  return config;
}

async function getClient(accountId) {
  const { apiUrl, apiKey } = await getEvolutionConfig(accountId);
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
  client.interceptors.response.use(
    (res) => {
      try {
        console.log('[Evolution] Response', { url: res?.config?.url, status: res?.status });
      } catch {}
      return res;
    },
    (error) => {
      try {
        const res = error?.response;
        console.error('[Evolution] Response error', {
          url: res?.config?.url || error?.config?.url,
          status: res?.status,
          data: res?.data,
          headers: res?.headers,
        });
      } catch {}
      return Promise.reject(error);
    }
  );
  console.log('[Evolution] Axios client criado', { baseURL: apiUrl, apiKeyPreview: mask(apiKey) });
  return client;
}

async function createInstance(accountId, payload) {
  const client = await getClient(accountId);
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
    console.log('[EvolutionService.createInstance] Enviando payload', { accountId, url: client.defaults.baseURL + '/instance/create', payload: prev });
  } catch {}
  const { data } = await client.post('/instance/create', payload);
  return data;
}

async function setChatwoot(accountId, instance, payload) {
  const client = await getClient(accountId);
  try {
    const prev = {
      ...payload,
      tokenPreview: payload?.token ? String(payload.token).slice(0, 4) + '****' : undefined,
      token: undefined,
    };
    console.log('[EvolutionService.setChatwoot] POST', {
      url: client?.defaults?.baseURL + `/chatwoot/set/${encodeURIComponent(instance)}`,
      payload: prev,
    });
  } catch {}
  try {
    const { data } = await client.post(`/chatwoot/set/${encodeURIComponent(instance)}`, payload);
    return data;
  } catch (e) {
    console.error('[EvolutionService.setChatwoot] Request failed', {
      url: e?.config?.url,
      status: e?.response?.status,
      data: e?.response?.data,
      headers: e?.response?.headers,
    });
    throw e;
  }
}

async function connect(accountId, instance, number) {
  const client = await getClient(accountId);
  const params = {};
  if (number) params.number = number;
  const { data } = await client.get(`/instance/connect/${encodeURIComponent(instance)}`, { params });
  return data; // { pairingCode, code, count }
}

async function connectionState(accountId, instance) {
  const client = await getClient(accountId);
  const path = `/instance/connectionState/${encodeURIComponent(instance)}`;
  console.log('[Evolution] Chamando connectionState', { accountId, instance, path });
  const { data } = await client.get(path);
  return data; // { instance: { instanceName, state } }
}

async function deleteInstance(accountId, instance) {
  const client = await getClient(accountId);
  const path = `/instance/delete/${encodeURIComponent(instance)}`;
  console.log('[Evolution] Deletando instância', { accountId, instance, path });
  const { data } = await client.delete(path);
  return data;
}

module.exports = { 
  createInstance, 
  setChatwoot, 
  connect, 
  connectionState, 
  deleteInstance,
  getParameterValue // Exportar helper para uso em outros módulos
};

// ================= Chatwoot Provisioning =================
async function provisionChatwoot(accountId) {
  // Buscar parâmetros com fallback para product_parameter
  const chatwootUrl = await getParameterValue(accountId, 'chatwoot-url', {
    required: true,
    aliases: ['CHATWOOT_URL']
  });
  
  const chatwootToken = await getParameterValue(accountId, 'chatwoot-token', {
    required: true,
    aliases: ['CHATWOOT_TOKEN']
  });

  // Token de plataforma para endpoints "/platform" (busca com fallback)
  let platformTokenRaw = await getParameterValue(accountId, 'chatwoot-platform-token', {
    required: false,
    aliases: ['CHATWOOT_PLATFORM_TOKEN']
  });
  
  // Fallback para env ou valor padrão
  if (!platformTokenRaw) {
    platformTokenRaw = process.env.CHATWOOT_PLATFORM_TOKEN || 'h5Gj43DZYb5HnY75gpGwUE3T';
  }
  
  const platformToken = String(platformTokenRaw).replace(/[\r\n\t\v\f]/g, '').trim();
  if (platformToken !== platformTokenRaw) {
    console.warn('[Chatwoot] platform token sanitizado (removidos caracteres de controle)', {
      accountId,
      beforePreview: mask(platformTokenRaw),
      afterPreview: mask(platformToken),
    });
  }
  
  // Buscar chatwoot-account com fallback (account_parameter → product_parameter)
  let chatwootAccountId = await getParameterValue(accountId, 'chatwoot-account', {
    required: false,
    aliases: ['CHATWOOT_ACCOUNT']
  });

  const db = getDbConnection();
  const account = await db('account').where({ id: accountId }).first();
  if (!account) throw new Error(`Conta não encontrada para account_id: ${accountId}`);

  // Para endpoints que contenham "/platform" usar api_access_token obtido
  const cw = axios.create({ baseURL: chatwootUrl, timeout: 20000, headers: { api_access_token: platformToken } });
  // Para endpoints de conta (não plataforma), utilizar chatwootToken da conta
  const cwAccount = axios.create({ baseURL: chatwootUrl, timeout: 20000, headers: { api_access_token: String(chatwootToken).trim() } });
  console.log('[Chatwoot] Provision start', { accountId, chatwootAccountId, url: chatwootUrl, tokenPreview: mask(chatwootToken), platformTokenPreview: mask(platformToken) });

  // 1) Reutilizar conta existente se já houver parâmetro chatwoot-account; caso contrário, criar
  if (chatwootAccountId) {
    try {
      const path = `/api/v1/accounts/${encodeURIComponent(String(chatwootAccountId).trim())}`;
      // Log detalhado da requisição de verificação (rota não plataforma)
      console.log('[Chatwoot] Verificando existência de conta (API)', {
        accountId,
        chatwootAccountId: String(chatwootAccountId).trim(),
        request: {
          method: 'GET',
          url: `${chatwootUrl}${path}`,
          baseURL: chatwootUrl,
          path,
          headers: { api_access_token_preview: mask(chatwootToken) },
        },
      });
      const { status } = await cwAccount.get(path);
      if (status >= 200 && status < 300) {
        console.log('[Chatwoot] Reutilizando chatwoot-account existente; pulando etapas de criação', { chatwootAccountId });
        // Retorna imediatamente sem criar usuário/associações, conforme solicitado
        return { chatwootAccountId: String(chatwootAccountId).trim(), chatwootToken: String(chatwootToken).trim(), chatwootUrl };
      }
    } catch (e) {
      console.warn('[Chatwoot] chatwoot-account informado mas não encontrado (API). Será criada nova conta.', {
        chatwootAccountId,
        error: e?.response?.status || e?.message || String(e),
        request: {
          method: 'GET',
          url: `${chatwootUrl}/api/v1/accounts/${encodeURIComponent(String(chatwootAccountId).trim())}`,
          baseURL: chatwootUrl,
          path: `/api/v1/accounts/${encodeURIComponent(String(chatwootAccountId).trim())}`,
          headers: { api_access_token_preview: mask(chatwootToken) },
        },
      });
      chatwootAccountId = undefined;
    }
  }

  if (!chatwootAccountId) {
    const accBody = { name: account.name || account.domain, locale: 'pt_BR' };
    const { data: accResp } = await cw.post('/platform/api/v1/accounts', accBody);
    chatwootAccountId = accResp?.id || accResp?.data?.id;
    if (!chatwootAccountId) throw new Error('Falha ao criar conta no Chatwoot: ID ausente na resposta');
  }

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

  console.log('[Chatwoot] Provisioned', { accountId, chatwootAccountId });
  return { chatwootAccountId, chatwootToken: String(chatwootToken).trim(), chatwootUrl };
}

module.exports.provisionChatwoot = provisionChatwoot;

// ================= Chatwoot post-instance configuration =================
/**
 * Cria Agent Bot, associa à Inbox e salva parâmetro chatwoot-inbox.
 * @param {string} accountId
 * @param {string} instanceName Nome da instância (usado como nome da inbox)
 * @param {Object} options Parâmetros opcionais para evitar consultas duplicadas
 * @param {string} options.chatwootUrl URL do Chatwoot (opcional, busca se não fornecido)
 * @param {string} options.chatwootToken Token do Chatwoot (opcional, busca se não fornecido)
 * @param {string} options.chatwootAccountId ID da conta no Chatwoot (opcional, busca se não fornecido)
 */
async function configureChatwootInbox(accountId, instanceName, options = {}) {
  const db = getDbConnection();
  if (!accountId) throw new Error('account_id é obrigatório');
  if (!instanceName) throw new Error('instanceName é obrigatório');

  // Buscar parâmetros apenas se não foram fornecidos (evita consultas duplicadas)
  const chatwootUrl = options.chatwootUrl || await getParameterValue(accountId, 'chatwoot-url', {
    required: true,
    aliases: ['CHATWOOT_URL']
  });
  
  const chatwootToken = options.chatwootToken || await getParameterValue(accountId, 'chatwoot-token', {
    required: true,
    aliases: ['CHATWOOT_TOKEN']
  });
  
  const chatwootAccountId = options.chatwootAccountId || await getParameterValue(accountId, 'chatwoot-account', {
    required: true,
    aliases: ['CHATWOOT_ACCOUNT']
  });
  
  // Buscar account para obter product_id
  const account = await db('account').where({ id: accountId }).first();
  if (!account) throw new Error(`Conta não encontrada para account_id: ${accountId}`);

  // Buscar parâmetros do produto para obter n8n_input_webhook (webhook de entrada do Agent)
  let inputWebhook;
  if (account.product_id) {
    const prodParamsRows = await db('product_parameter')
      .where('product_id', account.product_id)
      .select('name', 'value');
    const pparams = formatParameters(prodParamsRows);
    inputWebhook =
      pparams['n8n_input_webhook'] ||
      pparams['n8n-input-webhook'] ||
      pparams['N8N_INPUT_WEBHOOK'];
  }
  const outgoingUrl = inputWebhook || 'https://auto.autonomia.site/webhook/input-follow';

  const cw = axios.create({ baseURL: chatwootUrl, timeout: 20000, headers: { api_access_token: String(chatwootToken).trim() } });

  // 0) Atualizar feature_flags na tabela accounts do Chatwoot antes de criar o Agent Bot
  //    e manter a mesma conexão para consultar a inbox por SELECT
  let chatwootDb;
  try {
    chatwootDb = await createChatwootDbConnection(accountId);
    console.log('[Chatwoot] Atualizando feature_flags na conta', { accountId, chatwootAccountId });
    await chatwootDb.raw('UPDATE accounts SET feature_flags = ? WHERE id = ?', [1099243192319, chatwootAccountId]);
    console.log('[Chatwoot] feature_flags atualizado com sucesso');
  } catch (e) {
    console.warn('[Chatwoot] Não foi possível atualizar feature_flags antes do Agent Bot', { accountId, error: e?.message || e });
    // seguir sem interromper o fluxo
  }

  // 1) Obter (ou criar) Agent Bot
  //    Primeiro tenta reutilizar um existente via SELECT em agent_bots; se não houver, cria via API
  const botBody = {
    name: account.name || account.domain,
    description: 'Agente conversacional',
    outgoing_url: outgoingUrl,
    bot_type: 0,
    bot_config: {},
  };
  let botId;
  try {
    if (!chatwootDb) throw new Error('Conexão Chatwoot DB indisponível para consultar Agent Bot');
    const botRow = await chatwootDb('agent_bots')
      .select('id')
      .where({ account_id: chatwootAccountId })
      .first();
    if (botRow?.id) {
      botId = botRow.id;
      console.log('[Chatwoot] Agent Bot existente encontrado; reutilizando', { botId, chatwootAccountId });
    }
  } catch (e) {
    console.warn('[Chatwoot] Falha ao consultar Agent Bot existente; prosseguindo para criação', { error: e?.message || e });
  }

  if (!botId) {
    try {
      const { data: botResp } = await cw.post(`/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}/agent_bots`, botBody);
      botId = botResp?.id || botResp?.data?.id;
      if (!botId) throw new Error('Resposta sem id do Agent Bot');
      console.log('[Chatwoot] Agent Bot criado', { botId, chatwootAccountId });
    } catch (e) {
      console.error('[Chatwoot] Falha ao criar Agent Bot', { error: e?.response?.data || e?.message || e });
      throw e;
    }
  }

  // 2) Obter inbox id via SELECT no banco do Chatwoot ou via API
  let inboxId;
  
  // 2.1) Tentar via SELECT direto no banco (mais rápido)
  if (chatwootDb) {
    try {
      const row = await chatwootDb('inboxes')
        .select('id')
        .where({ account_id: chatwootAccountId, name: String(instanceName).trim() })
        .first();
      console.log('[Chatwoot] Inbox encontrada via SELECT', {
        instanceName,
        chatwootAccountId,
        found: !!row,
        inboxId: row?.id,
      });
      inboxId = row?.id;
    } catch (e) {
      console.error('[Chatwoot] Falha ao consultar inbox via SELECT', { error: e?.message || e });
    } finally {
      try { await chatwootDb.destroy(); } catch {}
    }
  } else {
    console.warn('[Chatwoot] chatwootDb não disponível, pulando SELECT de inbox');
  }
  
  // 2.2) Se não encontrou via SELECT, buscar via API do Chatwoot
  if (!inboxId) {
    try {
      console.log('[Chatwoot] Buscando inbox via API', { chatwootAccountId, instanceName });
      const { data: inboxes } = await cw.get(`/api/v1/accounts/${encodeURIComponent(chatwootAccountId)}/inboxes`);
      const inbox = inboxes?.payload?.find(i => i.name === String(instanceName).trim());
      if (inbox) {
        inboxId = inbox.id;
        console.log('[Chatwoot] Inbox encontrada via API', { inboxId, name: inbox.name });
      }
    } catch (e) {
      console.error('[Chatwoot] Falha ao buscar inbox via API', { error: e?.response?.data || e?.message || e });
    }
  }
  
  if (!inboxId) {
    throw new Error(`Inbox não encontrada para nome: ${instanceName} (tentado via SELECT e API)`);
  }

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

  console.log('[Chatwoot] Agent Bot criado e associado à inbox', { accountId, chatwootAccountId, botId, inboxId, instanceName });
  return { botId, inboxId };
}

module.exports.configureChatwootInbox = configureChatwootInbox;
