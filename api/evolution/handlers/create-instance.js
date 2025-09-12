const { createInstance, connectionState, deleteInstance, connect, provisionChatwoot, configureChatwootInbox } = require('../services/evolution-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');
const { getDbConnection } = require('../utils/database');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const origin = getOrigin(event);
    const body = JSON.parse(event.body || '{}');
    const qs = event.queryStringParameters || {};
    const domain = body.domain || qs.domain;

    // We accept the same payload structure from Evolution API docs
    // Example minimal fields: instanceName, token, qrcode, number, integration, webhook, chatwoot*
    if (!body.instanceName) {
      return createResponse(400, { message: 'instanceName é obrigatório' }, origin);
    }
    if (!domain) {
      return createResponse(400, { message: 'domain é obrigatório' }, origin);
    }

    // Montar payload esperado pela Evolution API
    const payload = (() => {
      // Defaults e mapeamentos
      const instanceName = String(body.instanceName || '').trim();
      const token = body.token ? String(body.token) : undefined;
      const qrcode = typeof body.qrcode === 'boolean' ? body.qrcode : true;
      const integration = body.integration || 'WHATSAPP-BAILEYS';
      const groups_ignore = typeof body.groups_ignore === 'boolean' ? body.groups_ignore : true;
      const always_online = typeof body.always_online === 'boolean' ? body.always_online : true;

      // Número pode vir em body.number, body.phone ou ser o próprio instanceName quando numérico
      let number = body.number || body.phone || undefined;
      const nameLooksLikeNumber = typeof instanceName === 'string' && /^(\+)?\d{6,}$/.test(instanceName.replace(/\D/g, ''));
      if (!number && nameLooksLikeNumber) {
        // manter formatação básica se vier com +, senão apenas dígitos
        number = instanceName;
      }

      // Remover campos undefined do objeto final
      const out = { instanceName, qrcode, integration, groups_ignore, always_online };
      if (token) out.token = token;
      if (number) out.number = String(number);

      // Compatibilidade com possíveis variações de chave da Evolution (camelCase)
      // Duplicamos as flags em camelCase para evitar problemas de mapeamento no provedor
      out.groupsIgnore = typeof out.groups_ignore === 'boolean' ? out.groups_ignore : true;
      out.alwaysOnline = typeof out.always_online === 'boolean' ? out.always_online : true;
      return out;
    })();

    // Se o caller já informar um Chatwoot account_id, pular o provisionamento e CONTINUAR o fluxo
    let chatwootAccountId, chatwootToken, chatwootUrl;
    if (body.account_id) {
      chatwootAccountId = String(body.account_id).trim();
      chatwootUrl = String(body.chatwootUrl || '').trim();
      chatwootToken = String(body.chatwootToken || '').trim();
      if (!chatwootUrl || !chatwootToken) {
        return createResponse(400, { message: 'Para usar account_id, é obrigatório informar chatwootUrl e chatwootToken' }, origin);
      }
      console.log('[CreateInstance] account_id informado; pulando provisionamento Chatwoot', { domain, instance: payload.instanceName, account_id: chatwootAccountId });

      // Persistir parâmetros para serem usados por configureChatwootInbox
      const db = getDbConnection();
      const account = await db('account').where({ domain }).first();
      if (!account) {
        return createResponse(400, { message: `Conta não encontrada para domain: ${domain}` }, origin);
      }
      const upsertParam = async (name, value) => {
        const existing = await db('account_parameter').where({ account_id: account.id, name }).first();
        if (existing) await db('account_parameter').where({ id: existing.id }).update({ value: String(value) });
        else await db('account_parameter').insert({ account_id: account.id, name, value: String(value) });
      };
      await upsertParam('chatwoot-account', chatwootAccountId);
      await upsertParam('chatwoot-url', chatwootUrl);
      await upsertParam('chatwoot-token', chatwootToken);
    } else {
      // 1-3) Provisionamento Chatwoot: criar conta, usuário e associar
      ({ chatwootAccountId, chatwootToken, chatwootUrl } = await provisionChatwoot(domain));
    }

    // 4) Enriquecer payload com os campos de Chatwoot e flags adicionais
    Object.assign(payload, {
      syncFullHistory: false,
      chatwootAccountId: String(chatwootAccountId),
      chatwootToken: String(chatwootToken),
      chatwootUrl: String(chatwootUrl),
      chatwootSignMsg: false,
      chatwootReopenConversation: false,
      chatwootConversationPending: false,
      chatwootImportContacts: true,
      chatwootNameInbox: payload.instanceName,
      chatwootMergeBrazilContacts: false,
      chatwootImportMessages: false,
      chatwootDaysLimitImportMessages: 30,
      autoCreate:true,
      chatwootOrganization: 'Gerador de QR',
    });

    // Log sanitizado para auditoria (sem expor token e número completos)
    try {
      const preview = {
        instanceName: payload.instanceName,
        integration: payload.integration,
        qrcode: payload.qrcode,
        groups_ignore: payload.groups_ignore,
        groupsIgnore: payload.groupsIgnore,
        always_online: payload.always_online,
        alwaysOnline: payload.alwaysOnline,
        chatwootAccountId: payload.chatwootAccountId,
        chatwootUrl: payload.chatwootUrl,
        numberPreview: payload.number ? String(payload.number).replace(/.(?=.{4})/g, '*') : undefined,
        tokenPreview: payload.token ? String(payload.token).slice(0, 4) + '****' : undefined,
      };
      console.log('[CreateInstance] Payload preparado', { domain, payload: preview });
    } catch {}

    // Se a instância estiver em 'connecting' ou 'close', deletar antes de criar
    try {
      const stateResp = await connectionState(domain, payload.instanceName);
      const state = stateResp?.instance?.state;
      console.log('[CreateInstance] Estado atual da instância', { instance: payload.instanceName, state });
      if (state === 'connecting' || state === 'close') {
        try {
          await deleteInstance(domain, payload.instanceName);
          console.log('[CreateInstance] Instância deletada para recriação', { instance: payload.instanceName });
        } catch (delErr) {
          console.warn('[CreateInstance] Falha ao deletar instância antes da recriação', { instance: payload.instanceName, error: delErr?.message || delErr });
        }
      }
    } catch (stErr) {
      // Se não conseguir obter estado, prosseguir mesmo assim
      console.warn('[CreateInstance] Não foi possível obter estado da instância, prosseguindo com criação', { instance: payload.instanceName, error: stErr?.message || stErr });
    }

    const result = await createInstance(domain, payload);

    // Opcional: buscar pairingCode imediatamente após criação
    // Caso a Evolution retorne o QR em base64 já na criação (quando qrcode=true), ele já estará em `result`.
    // pairingCode tipicamente vem de /instance/connect
    let enriched = result;
    try {
      const connectResp = await connect(domain, payload.instanceName, payload.number);
      // Mesclar mantendo todos os dados originais do create + dados do connect (pairingCode, etc)
      enriched = { ...result, ...connectResp };
    } catch (e) {
      console.warn('Connect pós-criação falhou, retornando apenas dados de criação', e?.message || e);
    }

    // 5) Configurar Chatwoot: criar Agent Bot, associar à inbox e salvar parâmetro chatwoot-inbox
    try {
      const cfg = await configureChatwootInbox(domain, payload.instanceName);
      enriched = { ...enriched, chatwootAgentBotId: cfg?.botId, chatwootInboxId: cfg?.inboxId };
      console.log('[CreateInstance] Chatwoot inbox configurada', { instance: payload.instanceName, botId: cfg?.botId, inboxId: cfg?.inboxId });
    } catch (cfgErr) {
      console.warn('[CreateInstance] Falha ao configurar Chatwoot (agent bot/inbox). Prosseguindo.', { error: cfgErr?.message || cfgErr });
    }

    return createResponse(201, enriched, origin);
  } catch (err) {
    console.error('Erro em CreateInstance:', err);
    return createResponse(500, { message: 'Erro ao criar instância', details: err.message }, getOrigin(event));
  }
};
