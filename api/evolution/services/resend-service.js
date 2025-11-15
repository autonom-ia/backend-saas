const axios = require('axios');
const knex = require('knex');
const { getDbConnection } = require('../utils/database');
const { formatParameters } = require('../utils/format-parameters');

// Constants
const DEFAULT_ACCOUNT_ID = 'ee7562a7-33d1-4459-b95a-484a1263727d';

// Simple masking for sensitive values in logs
function mask(value) {
  try {
    const str = String(value || '');
    if (str.length <= 8) return '****';
    return `${str.slice(0, 4)}****${str.slice(-4)}`;
  } catch {
    return '****';
  }
}

function envFlag(name, def = 'false') {
  return (process.env[name] || def).toString() === 'true';
}

function envInt(name, def) {
  const v = parseInt(process.env[name] || def, 10);
  return Number.isFinite(v) ? v : def;
}

// Evolution DB connection via env or provided defaults
function createEvolutionDb() {
  const host = process.env.EVOLUTION_DB_HOST || '31.97.240.26';
  const port = Number(process.env.EVOLUTION_DB_PORT || 5432);
  const user = process.env.EVOLUTION_DB_USER || 'postgres';
  const password = process.env.EVOLUTION_DB_PASSWORD || 'Mfcd62!!Mfcd62!!';
  const database = process.env.EVOLUTION_DB_NAME || 'evolution';

  const db = knex({
    client: 'pg',
    connection: { host, port, user, password, database },
    pool: { min: 0, max: 5 },
    acquireConnectionTimeout: 10000,
  });
  return db;
}

async function getChatwootParamsFromAccount(mainDb, accountId) {
  // Importar helper com fallback para product_parameter
  const { getParameterValue } = require('./evolution-service');
  
  // Buscar parâmetros com fallback
  const baseUrlRaw = await getParameterValue(accountId, 'chatwoot-url', {
    required: true,
    aliases: ['CHATWOOT_URL', 'CHATWOOT_BASE_URL']
  });
  
  const accountIdRaw = await getParameterValue(accountId, 'chatwoot-account', {
    required: true,
    aliases: ['CHATWOOT_ACCOUNT', 'CHATWOOT_ACCOUNT_ID']
  });
  
  const tokenRaw = await getParameterValue(accountId, 'chatwoot-token', {
    required: true,
    aliases: ['CHATWOOT_TOKEN']
  });

  const CHATWOOT_BASE_URL = String(baseUrlRaw || '').trim().replace(/\/+$/, '');
  const CHATWOOT_ACCOUNT_ID = String(accountIdRaw || '').trim();
  const CHATWOOT_TOKEN = String(tokenRaw || '').trim();

  return { CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_TOKEN };
}

async function httpPostWithRetry(url, data, headers, retries = 3, backoffMs = 500, timeoutMs = 8000) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      // Request log (avoid leaking tokens)
      try {
        console.log('[HTTP POST] Attempt', {
          attempt: `${i + 1}/${retries + 1}`,
          url,
          timeoutMs,
          headers: { ...headers, api_access_token: headers?.api_access_token ? mask(headers.api_access_token) : undefined },
          payloadPreview: (() => {
            try { return JSON.stringify(data).slice(0, 500); } catch { return '[unserializable]'; }
          })(),
        });
      } catch {}

      const res = await axios.post(url, data, { headers, timeout: timeoutMs });

      // Response log
      try {
        console.log('[HTTP POST] Response', {
          status: res?.status,
          statusText: res?.statusText,
          dataPreview: (() => {
            try { return JSON.stringify(res?.data).slice(0, 800); } catch { return '[unserializable]'; }
          })(),
        });
      } catch {}
      return res;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const retryable = !status || status >= 500 || status === 429;
      try {
        console.warn('[HTTP POST] Error', {
          attempt: `${i + 1}/${retries + 1}`,
          status,
          message: err?.message,
          bodyPreview: (() => {
            try { return JSON.stringify(err?.response?.data).slice(0, 800); } catch { return String(err); }
          })(),
          willRetry: retryable && i < retries,
          nextBackoffMs: retryable && i < retries ? backoffMs * Math.pow(2, i) : 0,
        });
      } catch {}
      if (!retryable || i === retries) break;
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

function parseNumberFromJid(jid) {
  return (jid || '').split('@')[0] || '';
}

async function fetchCandidates(evoDb, lookback, limit) {
  const sql = `
    WITH now_epoch AS (SELECT EXTRACT(EPOCH FROM NOW())::bigint AS now_s)
    SELECT
      m."id",
      m."instanceId"                AS instance_id,
      m."messageType"               AS message_type,
      m."status",
      m."messageTimestamp"          AS wa_ts,
      m."chatwootConversationId"    AS conversation_id,
      m."chatwootInboxId"           AS inbox_id,
      (m."key"->>'id')              AS wa_id,
      (m."key"->>'remoteJid')       AS remote_jid,
      COALESCE((m."key"->>'fromMe')::boolean, false) AS from_me,
      (m."message"->>'conversation') AS text
    FROM "Message" m, now_epoch n
    WHERE COALESCE((m."key"->>'fromMe')::boolean, false) = false
      AND m."messageType" = 'conversation'
      AND (m."message"->>'conversation') IS NOT NULL
      AND m."chatwootMessageId" IS NULL
      AND m."messageTimestamp" BETWEEN (n.now_s - ?::int) AND (n.now_s + 5)
    ORDER BY m."messageTimestamp" ASC
    LIMIT ?
  `;
  const result = await evoDb.raw(sql, [lookback, limit]);
  return result.rows || [];
}

async function inferConversationId(evoDb, remoteJid, siblingWindowSec) {
  const sql = `
    WITH now_epoch AS (SELECT EXTRACT(EPOCH FROM NOW())::bigint AS now_s)
    SELECT m."chatwootConversationId" AS conversation_id
    FROM "Message" m, now_epoch n
    WHERE (m."key"->>'remoteJid') = ?
      AND m."chatwootConversationId" IS NOT NULL
      AND m."messageTimestamp" >= (n.now_s - ?::int)
    ORDER BY m."messageTimestamp" DESC
    LIMIT 1
  `;
  const result = await evoDb.raw(sql, [remoteJid, siblingWindowSec]);
  const row = (result.rows || [])[0];
  return row?.conversation_id || null;
}

async function updateMessageStamped(evoDb, evoId, chatwootMsgId, conversationIdMaybe) {
  const sql = `
    UPDATE "Message"
       SET "chatwootMessageId" = ?,
           "chatwootConversationId" = COALESCE("chatwootConversationId", ?)
     WHERE "id" = ?
  `;
  await evoDb.raw(sql, [chatwootMsgId, conversationIdMaybe || null, evoId]);
}

async function postToChatwoot(baseUrl, accountId, token, conversationId, text, waId, timeoutMs) {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
  const headers = {
    'api_access_token': token,
    'Content-Type': 'application/json',
    'User-Agent': 'evo-guard/1.0'
  };
  const payload = {
    content: text,
    message_type: 'incoming',
    private: false,
    content_attributes: { wa_id: waId, injected_by: 'evo-guard' },
    source_id: waId,
  };
  try {
    console.log('[Chatwoot][POST message] Request', {
      url,
      accountId,
      conversationId,
      timeoutMs,
      headers: { ...headers, api_access_token: mask(headers.api_access_token) },
      payloadPreview: {
        message_type: payload.message_type,
        private: payload.private,
        source_id: payload.source_id,
        contentLen: typeof payload.content === 'string' ? payload.content.length : undefined,
        contentPreview: typeof payload.content === 'string' ? payload.content.slice(0, 200) : undefined,
        content_attributes: payload.content_attributes,
      },
    });
  } catch {}
  const res = await httpPostWithRetry(url, payload, headers, 3, 500, timeoutMs);
  // Return the full response data so caller can log identifier/name/content
  return res.data;
}

async function ensureChatwootConversationForNumber(baseUrl, accountId, token, number, inboxId, timeoutMs) {
  const headers = { 'api_access_token': token, 'Content-Type': 'application/json' };
  const searchUrl = `${baseUrl}/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(number)}`;
  try {
    console.log('[Chatwoot][GET contact search] Request', {
      url: searchUrl,
      accountId,
      timeoutMs,
      headers: { ...headers, api_access_token: mask(headers.api_access_token) },
    });
  } catch {}
  const search = await axios.get(searchUrl, { headers, timeout: timeoutMs }).then(r => {
    try {
      console.log('[Chatwoot][GET contact search] Response', {
        status: r?.status,
        found: Array.isArray(r?.data?.payload) && r.data.payload.length > 0,
        firstContactId: Array.isArray(r?.data?.payload) && r.data.payload[0]?.id,
      });
    } catch {}
    return r.data;
  }).catch((e) => {
    try {
      console.warn('[Chatwoot][GET contact search] Error', {
        status: e?.response?.status,
        message: e?.message,
        bodyPreview: (() => { try { return JSON.stringify(e?.response?.data).slice(0, 500); } catch { return String(e); } })(),
      });
    } catch {}
    return null;
  });
  const contact = Array.isArray(search?.payload) ? search.payload[0] : null;
  if (!contact) return null;
  // Creation is optional, controlled by ALLOW_CREATE_CONVERSATION
  const createUrl = `${baseUrl}/api/v1/accounts/${accountId}/conversations`;
  const body = { source_id: `evo-guard:${number}:${Date.now()}`, inbox_id: inboxId, contact_id: contact.id, status: 'open' };
  try {
    console.log('[Chatwoot][POST conversation] Request', {
      url: createUrl,
      accountId,
      number,
      inboxId,
      timeoutMs,
      headers: { ...headers, api_access_token: mask(headers.api_access_token) },
      body,
    });
  } catch {}
  const res = await httpPostWithRetry(createUrl, body, headers, 3, 500, timeoutMs);
  try {
    console.log('[Chatwoot][POST conversation] Response', {
      status: res?.status,
      id: res?.data?.id || res?.data?.data?.id,
      dataPreview: (() => { try { return JSON.stringify(res?.data).slice(0, 800); } catch { return '[unserializable]'; } })(),
    });
  } catch {}
  return res.data?.id || null;
}

async function resendUnprocessedToChatwoot(options = {}) {
  const {
    accountId = DEFAULT_ACCOUNT_ID,
    lookbackSeconds = envInt('LOOKBACK_SECONDS', 120),
    batchLimit = envInt('BATCH_LIMIT', 50),
    inferFromSiblings = envFlag('INFER_CONVERSATION_FROM_SIBLINGS', 'true'),
    allowCreateConversation = envFlag('ALLOW_CREATE_CONVERSATION', 'false'),
    siblingLookbackSeconds = envInt('SIBLING_LOOKBACK_SECONDS', 43200),
    requestTimeoutMs = envInt('REQUEST_TIMEOUT_MS', 12000),
    dryRun = envFlag('DRY_RUN', 'false'),
  } = options;

  // Main DB to read account parameters
  const mainDb = getDbConnection();
  const evoDb = createEvolutionDb();

  const summary = {
    scanned: 0,
    posted: 0,
    skippedNoConversation: 0,
    skippedEmptyText: 0,
    errors: 0,
  };

  try {
    const { CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_TOKEN } = await getChatwootParamsFromAccount(mainDb, accountId);

    const candidates = await fetchCandidates(evoDb, lookbackSeconds, batchLimit);
    summary.scanned = candidates.length;

    for (const m of candidates) {
      const { id: evoId, conversation_id: convIdRaw, inbox_id: inboxId, text, wa_id: waId, remote_jid: remoteJid } = m;
      if (!text || !String(text).trim()) { summary.skippedEmptyText++; continue; }

      let conversationId = convIdRaw;

      if (!conversationId && inferFromSiblings && remoteJid) {
        try { conversationId = await inferConversationId(evoDb, remoteJid, siblingLookbackSeconds); } catch (_) {}
      }

      if (!conversationId && allowCreateConversation) {
        try {
          const number = parseNumberFromJid(remoteJid);
          const created = await ensureChatwootConversationForNumber(CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_TOKEN, number, inboxId, requestTimeoutMs);
          if (created) conversationId = created;
        } catch (_) {}
      }

      if (!conversationId) { summary.skippedNoConversation++; continue; }

      if (dryRun) {
        console.log(`[DRY_RUN] Postaria em conv ${conversationId} | wa:${waId} | evo:${evoId} | "${String(text).slice(0,120)}"`);
        summary.posted++;
        continue;
      }

      try {
        const cwData = await postToChatwoot(
          CHATWOOT_BASE_URL,
          CHATWOOT_ACCOUNT_ID,
          CHATWOOT_TOKEN,
          conversationId,
          text,
          waId,
          requestTimeoutMs
        );
        const chatwootMsgId = cwData?.id;
        if (chatwootMsgId) {
          await updateMessageStamped(evoDb, evoId, chatwootMsgId, conversationId);
          // Detailed log including sender identifier, name and content
          try {
            console.log('[Resend][UPDATED]', {
              evoId,
              conversationId,
              chatwootMsgId,
              waId,
              sender_identifier: cwData?.sender?.identifier,
              sender_name: cwData?.sender?.name,
              content: cwData?.content,
            });
          } catch {}
          summary.posted++;
        } else {
          console.warn(`WARN sem chatwootMsgId | evo:${evoId} conv:${conversationId} wa:${waId}`);
          summary.errors++;
        }
      } catch (e) {
        summary.errors++;
        const status = e.response?.status;
        const body = e.response?.data ? JSON.stringify(e.response.data).slice(0, 300) : String(e.message);
        console.error(`ERR evo:${evoId} conv:${conversationId} wa:${waId} status:${status} body:${body}`);
      }
    }

    return { ok: true, ...summary };
  } finally {
    try { await evoDb.destroy(); } catch {}
    // mainDb is managed by pool in utils/database; do not destroy here
  }
}

module.exports = { resendUnprocessedToChatwoot };
