const axios = require('axios');
const { setChatwoot, configureChatwootInbox, provisionChatwoot } = require('../services/evolution-service');
const { getDbConnection } = require('../utils/database');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const origin = getOrigin(event);
    const body = JSON.parse(event.body || '{}');
    const qs = event.queryStringParameters || {};
    const path = event.pathParameters || {};
    const domain = body.domain || qs.domain;

    // instance pode vir na URL (/chatwoot/set/{instance}) ou no body.instanceName
    const instance = path.instance || body.instanceName || body.instance || qs.instance;
    if (!instance) {
      return createResponse(400, { message: 'Parâmetro instance é obrigatório (path ou body.instanceName).' }, origin);
    }
    if (!domain) {
      return createResponse(400, { message: 'domain é obrigatório' }, origin);
    }

    // Apenas os campos suportados pelo endpoint da Evolution (conforme cURL)
    const allowed = [
      'enabled',
      'account_id',
      'token',
      'url',
      'sign_msg',
      'sign_delimiter',
      'reopen_conversation',
      'conversation_pending',
      'import_contacts',
      'import_messages',
      'days_limit_import_messages',
      'auto_create',
    ];
    const payload = {};
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) payload[k] = body[k];
    }

    // Valores fixos (independem do body)
    payload.sign_msg = false;
    payload.reopen_conversation = false;
    payload.conversation_pending = false;
    payload.import_contacts = true;
    payload.import_messages = false;
    payload.days_limit_import_messages = 30;
    payload.auto_create = true;

    // Validação opcional: se account_id foi informado, checar existência na API do Chatwoot
    if (Object.prototype.hasOwnProperty.call(payload, 'account_id')) {
      const accountId = String(payload.account_id || '').trim();
      const cwUrl = String(body.url || '').trim();
      const cwToken = String(body.token || '').trim();

      if (!accountId) {
        return createResponse(400, { message: 'account_id informado é inválido' }, origin);
      }
      if (!cwUrl || !cwToken) {
        return createResponse(400, { message: 'Para validar account_id é obrigatório informar url e token' }, origin);
      }

      try {
        const path = `/api/v1/accounts/${encodeURIComponent(accountId)}`;
        const resp = await axios.get(`${cwUrl}${path}`, { headers: { api_access_token: cwToken } });
        if (resp.status < 200 || resp.status >= 300) {
          return createResponse(400, { message: 'account_id não encontrado na API do Chatwoot', status: resp.status }, origin);
        }
      } catch (e) {
        const status = e?.response?.status;
        const details = e?.response?.data || e?.message || String(e);
        return createResponse(400, { message: 'Falha ao validar account_id no Chatwoot', status, details }, origin);
      }
    }

    // Se account_id NÃO foi enviado, provisionar Chatwoot para a conta e preencher os campos obrigatórios
    if (!Object.prototype.hasOwnProperty.call(payload, 'account_id')) {
      try {
        const prov = await provisionChatwoot(domain);
        payload.account_id = prov.chatwootAccountId;
        if (!payload.url) payload.url = prov.chatwootUrl;
        if (!payload.token) payload.token = prov.chatwootToken;
        console.log('[set-chatwoot] Provision concluído. Campos preenchidos a partir do provisionamento', {
          account_id: String(payload.account_id),
          url: payload.url,
          tokenPreview: typeof payload.token === 'string' ? payload.token.slice(0, 4) + '****' : undefined,
        });
      } catch (provErr) {
        const msg = provErr?.message || String(provErr);
        return createResponse(400, { message: 'Falha ao provisionar Chatwoot para a conta', details: msg }, origin);
      }
    }

    // Persistir parâmetros na nossa base (para permitir configureChatwootInbox buscar valores)
    // Persistimos após possível provisionamento para garantir consistência
    try {
      const db = getDbConnection();
      const account = await db('account').where({ domain }).first();
      if (account) {
        const upsert = async (name, value) => {
          if (value === undefined || value === null || value === '') return;
          const existing = await db('account_parameter').where({ account_id: account.id, name }).first();
          if (existing) await db('account_parameter').where({ id: existing.id }).update({ value: String(value) });
          else await db('account_parameter').insert({ account_id: account.id, name, value: String(value) });
        };
        await upsert('chatwoot-account', payload.account_id);
        await upsert('chatwoot-url', payload.url);
        await upsert('chatwoot-token', payload.token);
      }
    } catch (e) {
      console.warn('[set-chatwoot] Falha ao persistir parâmetros locais (após provision)', e?.message || e);
    }

    // Normalizar tipos exigidos pela Evolution
    if (payload.account_id !== undefined && payload.account_id !== null) {
      const raw = String(payload.account_id).trim();
      // Evolution espera accountId como string
      payload.account_id = raw;
    }
    if (payload.url !== undefined && payload.url !== null) {
      payload.url = String(payload.url).trim();
    }
    if (payload.token !== undefined && payload.token !== null) {
      payload.token = String(payload.token).trim();
    }

    // Chamar Evolution API
    try {
      const preview = {
        instance,
        domain,
        body: {
          enabled: payload.enabled,
          url: payload.url,
          tokenPreview: typeof payload.token === 'string' ? payload.token.slice(0,4) + '****' : undefined,
          account_id: payload.account_id,
          accountId: payload.account_id,
          sign_msg: payload.sign_msg,
          signMsg: payload.sign_msg,
          reopen_conversation: payload.reopen_conversation,
          reopenConversation: payload.reopen_conversation,
          conversation_pending: payload.conversation_pending,
          conversationPending: payload.conversation_pending,
          import_contacts: payload.import_contacts,
          importContacts: payload.import_contacts,
          import_messages: payload.import_messages,
          importMessages: payload.import_messages,
          days_limit_import_messages: payload.days_limit_import_messages,
          daysLimitImportMessages: payload.days_limit_import_messages,
          auto_create: payload.auto_create,
          autoCreate: payload.auto_create,
        }
      };
      console.log('[set-chatwoot] Enviando para Evolution /chatwoot/set', preview);
    } catch {}
    // Construir payload compatível com a Evolution (duplicando camelCase)
    const evoPayload = (() => {
      const out = { ...payload };
      // Evolution requer accountId string
      out.accountId = payload.account_id != null ? String(payload.account_id) : undefined;
      out.signMsg = payload.sign_msg;
      out.reopenConversation = payload.reopen_conversation;
      out.conversationPending = payload.conversation_pending;
      out.importContacts = payload.import_contacts;
      out.importMessages = payload.import_messages;
      out.daysLimitImportMessages = payload.days_limit_import_messages;
      out.autoCreate = payload.auto_create;
      // Remover chaves undefined
      Object.keys(out).forEach(k => { if (out[k] === undefined) delete out[k]; });
      return out;
    })();
    let result;
    try {
      result = await setChatwoot(domain, instance, evoPayload);
    } catch (e) {
      const status = e?.response?.status || 400;
      const data = e?.response?.data;
      const details = data?.response || data || e?.message || String(e);
      console.error('[set-chatwoot] Evolution retornou erro', { status, details });
      return createResponse(status, { message: 'Erro na Evolution ao configurar Chatwoot', details }, origin);
    }

    // Configurar Agent Bot e Inbox no Chatwoot (atualiza feature_flags e seta bot/inbox)
    let cfg;
    try {
      cfg = await configureChatwootInbox(domain, String(instance));
    } catch (cfgErr) {
      console.warn('[set-chatwoot] Falha ao configurar Agent Bot/Inbox', cfgErr?.message || cfgErr);
    }

    return createResponse(200, { ...result, chatwootAgentBotId: cfg?.botId, chatwootInboxId: cfg?.inboxId }, origin);
  } catch (err) {
    console.error('Erro em SetChatwoot:', err);
    return createResponse(500, { message: 'Erro ao configurar Chatwoot', details: err.message }, getOrigin(event));
  }
};
