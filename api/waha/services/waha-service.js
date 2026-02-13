const axios = require('axios');
const { getDbConnection } = require('../utils/database');

// Helper to fetch parameter with fallback: account_parameter -> product_parameter
async function getParameterValue(accountId, paramName, options = {}) {
  const db = getDbConnection();
  const { required = false, aliases = [] } = options;

  const account = await db('account').where({ id: accountId }).first();
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const allNames = [paramName, ...aliases];

  // 1) Try account_parameter
  for (const name of allNames) {
    let accountParam = await db('account_parameter')
      .select('value')
      .where({ account_id: accountId, name })
      .first();

    if (!accountParam) {
      accountParam = await db('account_parameter')
        .select('value')
        .where({ account_id: accountId })
        .whereRaw('LOWER(short_description) = LOWER(?)', [name])
        .first();
    }

    if (accountParam && accountParam.value && String(accountParam.value).trim()) {
      console.log(`[Waha.getParameterValue] Found in account_parameter: ${paramName} (alias: ${name})`);
      return String(accountParam.value).trim();
    }
  }

  // 2) Fallback to product_parameter
  if (account.product_id) {
    for (const name of allNames) {
      let productParam = await db('product_parameter')
        .select('value')
        .where({ product_id: account.product_id, name })
        .first();

      if (!productParam) {
        productParam = await db('product_parameter')
          .select('value')
          .where({ product_id: account.product_id })
          .whereRaw('LOWER(short_description) = LOWER(?)', [name])
          .first();
      }

      if (productParam && productParam.value && String(productParam.value).trim()) {
        console.log(`[Waha.getParameterValue] Found in product_parameter (fallback): ${paramName} (alias: ${name})`);
        return String(productParam.value).trim();
      }
    }
  }

  if (required) {
    throw new Error(`Required parameter not found: ${paramName} (aliases: ${aliases.join(', ')})`);
  }

  console.log(`[Waha.getParameterValue] Parameter not found: ${paramName}`);
  return null;
}

async function getWahaConfig(accountId) {
  if (!accountId) {
    throw new Error('account_id is required');
  }

  const apiUrl = await getParameterValue(accountId, 'whatsapp-api-url', {
    required: true,
    aliases: ['WHATSAPP_API_URL', 'whatsapp-api-url-autonomia'],
  });

  const apiKey = await getParameterValue(accountId, 'api-key-whatsapp-api', {
    required: false,
    aliases: ['WHATSAPP_API_KEY', 'whatsapp-api-key', 'whatsapp-api-apikey'],
  });

  return { apiUrl, apiKey };
}

async function getWahaClient(accountId) {
  const { apiUrl, apiKey } = await getWahaConfig(accountId);

  const client = axios.create({ baseURL: apiUrl, timeout: 20000 });

  client.interceptors.request.use((config) => {
    const cfg = { ...config };
    cfg.headers = cfg.headers || {};

    if (apiKey) {
      cfg.headers['x-api-key'] = String(apiKey).trim();
    }

    return cfg;
  });

  return client;
}

async function getInboxForAccount(accountId, inboxId) {
  const db = getDbConnection();
  const inbox = await db('inbox')
    .where({ id: inboxId, account_id: accountId })
    .first();

  if (!inbox) {
    throw new Error(`Inbox not found for account ${accountId} and id ${inboxId}`);
  }

  return inbox;
}

async function createSession(accountId, payload) {
  const client = await getWahaClient(accountId);
  const inboxId = payload.inbox_id;
  if (!inboxId) {
    throw new Error('inbox_id is required');
  }

  const inbox = await getInboxForAccount(accountId, inboxId);
  const name = String(inbox.name || '').trim();

  // If session already exists in WAHA, just return its data
  try {
    const existing = await client.get(`/api/sessions/${encodeURIComponent(name)}`);
    if (existing && existing.data) {
      const existingSession = existing.data;
      const status = existingSession && (existingSession.state || existingSession.status);

      if (status === 'FAILED') {
        // Se a sessão estiver em estado FAILED, exclui e recria
        try {
          await client.delete(`/api/sessions/${encodeURIComponent(name)}`);
        } catch (deleteErr) {
          try {
            console.error('[WahaService.createSession] Failed to delete FAILED session', {
              accountId,
              name,
              message: deleteErr && deleteErr.message,
            });
          } catch (logErr) {
            // Ignorar erro de log
          }
        }
        // prossegue para criação de nova sessão abaixo
      } else {
        // Sessão existente e não falhada: reutiliza
        return existingSession;
      }
    }
  } catch (err) {
    const status = err && err.response && err.response.status;
    const notFound = status === 404;
    if (!notFound) {
      throw err;
    }
    // 404 = session does not exist, proceed to create
  }

  // Build fixed body for WAHA create session
  const proxyServer = process.env.WAHA_PROXY_SERVER;
  const proxyUsername = process.env.WAHA_PROXY_USERNAME;
  const proxyPassword = process.env.WAHA_PROXY_PASSWORD;

  const config = {
    debug: false,
    ignore: {
      status: false,
      groups: true,
      channels: false,
    },
  };

  if (proxyServer && proxyUsername && proxyPassword) {
    config.proxy = {
      server: proxyServer,
      username: proxyUsername,
      password: proxyPassword,
    };
  }

  const body = {
    name,
    start: true,
    config,
  };

  try {
    console.log('[WahaService.createSession] Request', {
      accountId,
      name,
      hasConfig: !!body.config,
      start: body.start,
    });
  } catch (e) {
    // Ignore logging errors
  }

  const { data: session } = await client.post('/api/sessions/', body);
  return session;
}

async function connectionState(accountId, inboxId) {
  const client = await getWahaClient(accountId);
  if (!inboxId) {
    throw new Error('inbox_id is required');
  }

  const inbox = await getInboxForAccount(accountId, inboxId);
  const name = String(inbox.name || '').trim();
  const { data: session } = await client.get(`/api/sessions/${encodeURIComponent(name)}`);

  const status = session && (session.state || session.status);
  const shouldScanQr = status === 'SCAN_QR_CODE';

  let qr = null;

  if (!shouldScanQr) {
    return { session, qr };
  }

  // Quando a sessão está aguardando leitura de QR, buscamos o screenshot e
  // sincronizamos o ambiente WhatsApp/Chatwoot.
  try {
    const screenshotResp = await client.get('/api/screenshot', {
      params: { session: name },
      responseType: 'arraybuffer',
    });

    const contentType =
      (screenshotResp.headers && screenshotResp.headers['content-type']) || 'image/png';

    const base64 = Buffer.from(screenshotResp.data, 'binary').toString('base64');

    qr = {
      image: base64,
      contentType,
    };
  } catch (err) {
    try {
      console.error('[WahaService.connectionState] Failed to fetch QR screenshot', {
        accountId,
        name,
        message: err && err.message,
      });
    } catch (e) {
      // Ignorar erro de log
    }
  }

  return { session, qr };
}

// ================= Chatwoot Provisioning (local copy) =================
async function provisionChatwoot(accountId) {
  const chatwootUrl = await getParameterValue(accountId, 'chatwoot-url', {
    required: true,
    aliases: ['CHATWOOT_URL'],
  });

  const chatwootToken = await getParameterValue(accountId, 'chatwoot-token', {
    required: true,
    aliases: ['CHATWOOT_TOKEN'],
  });

  let platformTokenRaw = await getParameterValue(accountId, 'chatwoot-platform-token', {
    required: false,
    aliases: ['CHATWOOT_PLATFORM_TOKEN'],
  });

  if (!platformTokenRaw) {
    platformTokenRaw = process.env.CHATWOOT_PLATFORM_TOKEN || 'h5Gj43DZYb5HnY75gpGwUE3T';
  }

  const platformToken = String(platformTokenRaw).replace(/[\r\n\t\v\f]/g, '').trim();

  let chatwootAccountId = await getParameterValue(accountId, 'chatwoot-account', {
    required: false,
    aliases: ['CHATWOOT_ACCOUNT'],
  });

  const db = getDbConnection();
  const account = await db('account').where({ id: accountId }).first();
  if (!account) throw new Error(`Conta não encontrada para account_id: ${accountId}`);

  const cw = axios.create({
    baseURL: chatwootUrl,
    timeout: 20000,
    headers: { api_access_token: platformToken },
  });

  const cwAccount = axios.create({
    baseURL: chatwootUrl,
    timeout: 20000,
    headers: { api_access_token: String(chatwootToken).trim() },
  });

  if (chatwootAccountId) {
    try {
      const path = `/api/v1/accounts/${encodeURIComponent(String(chatwootAccountId).trim())}`;
      const { status } = await cwAccount.get(path);
      if (status >= 200 && status < 300) {
        return {
          chatwootAccountId: String(chatwootAccountId).trim(),
          chatwootToken: String(chatwootToken).trim(),
          chatwootUrl,
        };
      }
    } catch (e) {
      chatwootAccountId = undefined;
    }
  }

  if (!chatwootAccountId) {
    const accBody = { name: account.name || account.domain, locale: 'pt_BR' };
    const { data: accResp } = await cw.post('/platform/api/v1/accounts', accBody);
    chatwootAccountId = accResp?.id || accResp?.data?.id;
    if (!chatwootAccountId) {
      throw new Error('Falha ao criar conta no Chatwoot: ID ausente na resposta');
    }
  }

  const existingParam = await db('account_parameter')
    .where({ account_id: account.id, name: 'chatwoot-account' })
    .first();

  if (existingParam) {
    await db('account_parameter')
      .where({ id: existingParam.id })
      .update({ value: String(chatwootAccountId) });
  } else {
    await db('account_parameter')
      .insert({ account_id: account.id, name: 'chatwoot-account', value: String(chatwootAccountId) });
  }

  return {
    chatwootAccountId: String(chatwootAccountId).trim(),
    chatwootToken: String(chatwootToken).trim(),
    chatwootUrl,
  };
}

async function syncWhatsappEnvironment(accountId, inboxId) {
  if (!accountId) {
    throw new Error('account_id is required');
  }
  if (!inboxId) {
    throw new Error('inbox_id is required');
  }

  // 1) Provisionar conta no Chatwoot (ou reutilizar existente)
  const { chatwootAccountId, chatwootToken, chatwootUrl } = await provisionChatwoot(accountId);

  const db = getDbConnection();

  console.log('[Waha.syncWhatsappEnvironment] Start', { accountId, inboxId });

  const existingInboxParam = await getParameterValue(accountId, 'chatwoot-inbox', {
    required: false,
    aliases: ['CHATWOOT_INBOX'],
  });

  const whatsappApiUrl = await getParameterValue(accountId, 'whatsapp-api-url', {
    required: true,
    aliases: ['WHATSAPP_API_URL', 'whatsapp-api-url-autonomia'],
  });

  const account = await db('account').where({ id: accountId }).first();
  if (!account) {
    throw new Error(`Account not found for sync-whatsapp-environment: ${accountId}`);
  }

  const inbox = await getInboxForAccount(accountId, inboxId);

  const baseAccount = String(account.name || account.domain || '').toLowerCase();
  const normalizedAccount = baseAccount
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  const inboxName = String(inbox.name || '').trim() || 'Support';
  const normalizedInbox = inboxName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

  const slug = `${normalizedAccount}${normalizedInbox}`;

  const appId = `app_${slug}`;

  const baseWhatsappUrl = String(whatsappApiUrl).replace(/\/$/, '');
  const baseChatwootUrl = String(chatwootUrl).replace(/\/$/, '');

  const cwAccount = axios.create({
    baseURL: baseChatwootUrl,
    timeout: 20000,
    headers: { api_access_token: String(chatwootToken).trim() },
  });

  const webhookUrl = `${baseWhatsappUrl}/webhooks/chatwoot/${normalizedInbox}/${appId}`;

  let chatwootInboxId;
  let inboxResp;

  try {
    if (existingInboxParam) {
      chatwootInboxId = existingInboxParam;
      console.log('[Waha.syncWhatsappEnvironment] Using existing Chatwoot inbox', {
        accountId,
        inboxId,
        chatwootAccountId,
        chatwootInboxId,
      });

      const inboxPath = `/api/v1/accounts/${encodeURIComponent(
        String(chatwootAccountId).trim(),
      )}/inboxes/${encodeURIComponent(String(chatwootInboxId).trim())}`;

      const { data: getInboxResp } = await cwAccount.get(inboxPath);
      inboxResp = getInboxResp;

      const currentWebhookUrl =
        getInboxResp?.channel?.webhook_url || getInboxResp?.data?.channel?.webhook_url;

      if (!currentWebhookUrl) {
        const updatedChannel = {
          ...(getInboxResp?.channel || getInboxResp?.data?.channel || {}),
          webhook_url: webhookUrl,
        };

        const updateBody = {
          name: inboxName,
          timezone: 'America/Sao_Paulo',
          channel: updatedChannel,
        };

        console.log('[Waha.syncWhatsappEnvironment] Updating existing inbox website_url', {
          accountId,
          inboxId,
          chatwootInboxId,
          webhookUrl,
        });

        await cwAccount.put(inboxPath, updateBody);
      }
    } else {
      const inboxBody = {
        name: inboxName,
        timezone: 'America/Sao_Paulo',
        channel: {
          type: 'api',
          webhook_url: webhookUrl,
        },
      };

      const path = `/api/v1/accounts/${encodeURIComponent(
        String(chatwootAccountId).trim(),
      )}/inboxes/`;

      console.log('[Waha.syncWhatsappEnvironment] Creating Chatwoot inbox', {
        accountId,
        inboxId,
        chatwootAccountId,
        webhookUrl,
      });

      const { data: createdInboxResp } = await cwAccount.post(path, inboxBody);
      inboxResp = createdInboxResp;

      chatwootInboxId =
        createdInboxResp?.id || createdInboxResp?.data?.id;

      if (!chatwootInboxId) {
        throw new Error('Falha ao criar inbox no Chatwoot: ID ausente na resposta');
      }

      const existingParam = await db('account_parameter')
        .where({ account_id: account.id, name: 'chatwoot-inbox' })
        .first();

      if (existingParam) {
        await db('account_parameter')
          .where({ id: existingParam.id })
          .update({ value: String(chatwootInboxId) });
      } else {
        await db('account_parameter')
          .insert({ account_id: account.id, name: 'chatwoot-inbox', value: String(chatwootInboxId) });
      }
    }
  } catch (err) {
    console.error('[Waha.syncWhatsappEnvironment] Inbox sync failed', {
      accountId,
      inboxId,
      chatwootAccountId,
      message: err && err.message,
    });
    throw err;
  }

  // Criar Agent Bot e associar à inbox no Chatwoot apenas quando houver webhook de entrada definido
  const outgoingUrl = await getParameterValue(accountId, 'n8n_input_webhook', {
    required: false,
    aliases: ['N8N_INPUT_WEBHOOK'],
  });

  if (outgoingUrl) {
    const botBody = {
      name: account.name || account.domain,
      description: 'Agente conversacional',
      outgoing_url: outgoingUrl,
      bot_type: 0,
      bot_config: {},
    };

    let botId;
    try {
      // Primeiro, tentar reutilizar um Agent Bot existente para esta conta
      try {
        const { data: botsResp } = await cwAccount.get(
          `/api/v1/accounts/${encodeURIComponent(String(chatwootAccountId).trim())}/agent_bots`,
        );

        const existingBot = Array.isArray(botsResp?.data)
          ? botsResp.data[0]
          : Array.isArray(botsResp?.payload)
          ? botsResp.payload[0]
          : null;

        if (existingBot && (existingBot.id || existingBot.data?.id)) {
          botId = existingBot.id || existingBot.data?.id;
          console.log('[Waha.syncWhatsappEnvironment] Reusing existing Agent bot', {
            accountId,
            inboxId,
            chatwootAccountId,
            chatwootInboxId,
            botId,
          });
        }
      } catch (listErr) {
        console.warn('[Waha.syncWhatsappEnvironment] Failed to list existing Agent bots; will try to create one', {
          accountId,
          inboxId,
          chatwootAccountId,
          message: listErr && listErr.message,
        });
      }

      // Se não encontrou nenhum existente, criar um novo
      if (!botId) {
        const { data: botResp } = await cwAccount.post(
          `/api/v1/accounts/${encodeURIComponent(String(chatwootAccountId).trim())}/agent_bots`,
          botBody,
        );

        botId = botResp?.id || botResp?.data?.id;
        if (!botId) {
          throw new Error('Falha ao criar Agent Bot no Chatwoot: ID ausente na resposta');
        }

        console.log('[Waha.syncWhatsappEnvironment] Agent bot created', {
          accountId,
          inboxId,
          chatwootAccountId,
          chatwootInboxId,
          botId,
        });
      }

      await cwAccount.post(
        `/api/v1/accounts/${encodeURIComponent(String(chatwootAccountId).trim())}/inboxes/${encodeURIComponent(
          String(chatwootInboxId).trim(),
        )}/set_agent_bot`,
        { agent_bot: botId },
      );
    } catch (err) {
      console.error('[Waha.syncWhatsappEnvironment] Agent bot setup failed', {
        accountId,
        inboxId,
        chatwootAccountId,
        chatwootInboxId,
        message: err && err.message,
      });
      throw err;
    }
  }

  const inboxIdentifier =
    inboxResp?.inbox_identifier ||
    inboxResp?.data?.inbox_identifier ||
    null;

  const wahaClient = await getWahaClient(accountId);

  const appBody = {
    id: appId,
    session: inboxName,
    app: 'chatwoot',
    config: {
      locale: 'pt-BR',
      url: chatwootUrl,
      accountId: Number(chatwootAccountId),
      accountToken: String(chatwootToken).trim(),
      inboxId: Number(chatwootInboxId),
      inboxIdentifier,
      templates: {},
      linkPreview: 'HG',
      commands: {
        server: true,
        queue: true,
      },
      conversations: {
        sort: 'created_newest',
        status: null,
      },
    },
    enabled: true,
  };

  try {
    console.log('[Waha.syncWhatsappEnvironment] Creating WAHA app', {
      accountId,
      inboxId,
      appId,
      session: inboxName,
      chatwootAccountId,
      chatwootInboxId,
    });
    await wahaClient.post('/api/apps', appBody);
  } catch (err) {
    const status = err && err.response && err.response.status;
    const responseData = err && err.response && err.response.data;
    console.error('[Waha.syncWhatsappEnvironment] Failed to create WAHA app', {
      accountId,
      inboxId,
      appId,
      message: err && err.message,
      status,
      responseData,
    });
    throw err;
  }

  return {
    accountId,
    inboxId,
    inboxName,
    chatwootAccountId,
    chatwootInboxId,
    chatwootUrl,
    webhookUrl,
  };
}

module.exports = {
  createSession,
  connectionState,
  syncWhatsappEnvironment,
};
