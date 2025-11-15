const axios = require('axios');
const { setChatwoot, configureChatwootInbox, provisionChatwoot, getParameterValue } = require('../services/evolution-service');
const { getDbConnection } = require('../utils/database');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const origin = getOrigin(event);
    
    // Parse body com segurança (trata string vazia, null, undefined)
    let body = {};
    try {
      if (event.body && event.body.trim()) {
        body = JSON.parse(event.body);
      }
    } catch (parseErr) {
      console.warn('[set-chatwoot] Erro ao fazer parse do body, usando objeto vazio', parseErr.message);
    }
    
    const qs = event.queryStringParameters || {};
    const path = event.pathParameters || {};
    
    // accountId = UUID da conta no banco SAAS (obrigatório)
    const accountId = body.account_id || qs.account_id;

    // instance pode vir na URL (/chatwoot/set/{instance}) ou no body.instanceName
    const instance = path.instance || body.instanceName || body.instance || qs.instance;
    if (!instance) {
      return createResponse(400, { message: 'Parâmetro instance é obrigatório (path ou body.instanceName).' }, origin);
    }
    if (!accountId) {
      return createResponse(400, { message: 'account_id (UUID da conta SAAS) é obrigatório' }, origin);
    }

    // ===== PROVISIONAR CHATWOOT =====
    // Busca ou cria conta no Chatwoot, valida e retorna credenciais
    // Toda lógica de fallback, validação e criação está no service
    let chatwootAccountId, chatwootUrl, chatwootToken;
    try {
      console.log('[set-chatwoot] Iniciando provisionamento Chatwoot', { accountId, instance });
      const prov = await provisionChatwoot(accountId);
      
      chatwootAccountId = prov.chatwootAccountId;
      chatwootUrl = prov.chatwootUrl;
      chatwootToken = prov.chatwootToken;
      
      console.log('[set-chatwoot] Provisionamento concluído', {
        accountId,
        instance,
        chatwootAccountId,
        chatwootUrl
      });
    } catch (provErr) {
      const msg = provErr?.message || String(provErr);
      console.error('[set-chatwoot] Falha ao provisionar Chatwoot', { accountId, error: msg });
      return createResponse(400, { 
        message: 'Falha ao provisionar Chatwoot para a conta', 
        details: msg 
      }, origin);
    }

    // ===== MONTAR PAYLOAD PARA EVOLUTION API =====
    const payload = {
      enabled: body.enabled !== undefined ? body.enabled : true,
      account_id: chatwootAccountId,
      url: chatwootUrl,
      token: chatwootToken,
      sign_msg: false,
      reopen_conversation: false,
      conversation_pending: false,
      import_contacts: true,
      import_messages: false,
      days_limit_import_messages: 30,
      auto_create: true,
    };
    // ===== CONSTRUIR PAYLOAD PARA EVOLUTION API =====
    // Evolution aceita tanto snake_case quanto camelCase, enviamos ambos por compatibilidade
    const evoPayload = (() => {
      const out = { ...payload };
      // Duplicar em camelCase
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
    
    // ===== CHAMAR EVOLUTION API (setChatwoot) =====
    let result;
    try {
      // accountId aqui é UUID da conta SAAS (usado para buscar config da Evolution)
      result = await setChatwoot(accountId, instance, evoPayload);
      console.log('[set-chatwoot] Evolution API respondeu com sucesso');
    } catch (e) {
      const status = e?.response?.status || 400;
      const data = e?.response?.data;
      const details = data?.response || data || e?.message || String(e);
      console.error('[set-chatwoot] Evolution API retornou erro', { status, details });
      return createResponse(status, { message: 'Erro na Evolution ao configurar Chatwoot', details }, origin);
    }

    // ===== CONFIGURAR AGENT BOT E INBOX NO CHATWOOT =====
    // Cria Agent Bot, associa à Inbox e persiste parâmetro chatwoot-inbox
    // Passa parâmetros já obtidos para evitar consultas duplicadas
    let cfg;
    try {
      cfg = await configureChatwootInbox(accountId, String(instance), {
        chatwootUrl,
        chatwootToken,
        chatwootAccountId
      });
      console.log('[set-chatwoot] Agent Bot/Inbox configurados', { botId: cfg?.botId, inboxId: cfg?.inboxId });
    } catch (cfgErr) {
      console.warn('[set-chatwoot] Falha ao configurar Agent Bot/Inbox (não crítico)', cfgErr?.message || cfgErr);
    }

    return createResponse(200, { 
      ...result, 
      chatwootAgentBotId: cfg?.botId, 
      chatwootInboxId: cfg?.inboxId,
      chatwootAccountId  // Retornar o ID da conta no Chatwoot para referência
    }, origin);
  } catch (err) {
    console.error('Erro em SetChatwoot:', err);
    return createResponse(500, { message: 'Erro ao configurar Chatwoot', details: err.message }, getOrigin(event));
  }
};
