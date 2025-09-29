/**
 * Serviço para processar criação/consulta de contato e integração com scraping do carrinho
 */
const { getDbConnection } = require('../utils/database');
const SCRAPE_ENDPOINT = process.env.SCRAPE_ENDPOINT || 'https://scripts.autonomia.site/samsung/scrape';

/**
 * Processa os dados do carrinho para um contato
 * Fluxo:
 * - Verifica se já existe contato por (account_id, phone)
 *   - Se existir e contact_data.status === 'done' e houver finalLink -> retorna { type: 'finalLink', finalLink }
 *   - Caso contrário -> retorna { type: 'processing', message }
 * - Se não existir, chama API externa e cria contato com contact_data = resposta da API (enriquecida)
 *   - Retorna { type: 'processing', message }
 */
const processContactCart = async (payload) => {
  console.log('[processContactCart] start', {
    // não logar dados sensíveis completos
    hasPayload: !!payload,
    keys: Object.keys(payload || {}),
  });

  const { cpf, name, zipcode, phone, product, account_id, callback_url } = payload || {};

  console.log('[processContactCart] validating input', {
    cpf: cpf ? `${String(cpf).slice(0, 3)}***` : undefined,
    name: !!name,
    zipcode,
    phone: phone ? `${String(phone).slice(0, 4)}****` : undefined,
    product,
    account_id,
    callback_url,
  });

  if (!cpf) throw new Error('cpf é obrigatório');
  if (!name) throw new Error('name é obrigatório');
  if (!zipcode) throw new Error('zipcode é obrigatório');
  if (!phone) throw new Error('phone é obrigatório');
  if (!product) throw new Error('product é obrigatório');
  if (!account_id) throw new Error('account_id é obrigatório');
  if (!callback_url) throw new Error('callback_url é obrigatório');

  const db = getDbConnection();

  // 1) Verificar contato existente (chave por account + phone)
  console.log('[processContactCart] checking existing contact', { account_id, phone });
  const existing = await db('contact')
    .where({ account_id, phone })
    .first();
  console.log('[processContactCart] existing contact result', { found: !!existing, id: existing?.id });

  if (existing) {
    const data = existing.contact_data || {};
    console.log('[processContactCart] contact exists, evaluating status', {
      status: data?.status,
      hasFinalLink: !!data?.finalLink,
    });
    if (data && data.status === 'done' && data.finalLink) {
      console.log('[processContactCart] returning finalLink');
      return { type: 'finalLink', finalLink: data.finalLink };
    }
    console.log('[processContactCart] processing in progress (no finalLink yet)');
    return {
      type: 'processing',
      message: 'Estamos realizando fazendo a configuração do seu carrinho, em instantes retornaremos com o link para o checkout'
    };
  }

  // 2) Chamar API externa de scraping
  const body = {
    searchQuery: product,
    postalCode: zipcode,
    callbackUrl: callback_url,
  };
  console.log('[processContactCart] calling external API', {
    url: SCRAPE_ENDPOINT,
    body,
  });

  let apiResponse;
  try {
    const resp = await fetch(SCRAPE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log('[processContactCart] external API response status', { status: resp.status });
    const text = await resp.text();
    console.log('[processContactCart] external API raw response length', { length: text?.length });
    try {
      apiResponse = JSON.parse(text);
      console.log('[processContactCart] external API parsed JSON');
    } catch (_) {
      apiResponse = { raw: text };
      console.warn('[processContactCart] external API returned non-JSON, stored as raw');
    }
  } catch (err) {
    apiResponse = { error: true, message: err.message };
    console.error('[processContactCart] external API call failed', { error: err.message });
  }

  // 3) Criar contato somente se a API retornou com sucesso
  const extId = apiResponse?.id || apiResponse?.jobId || apiResponse?.data?.id;
  const extStatus = apiResponse?.status || apiResponse?.data?.status;

  if (!apiResponse || apiResponse.error || !extId) {
    console.error('[processContactCart] skipping insert due to external API error or missing id', {
      hasResponse: !!apiResponse,
      error: apiResponse?.error,
      message: apiResponse?.message,
    });
    throw new Error('Falha ao iniciar o processamento externo');
  }

  console.log('[processContactCart] preparing contact insert (empty contact_data)', { extId, extStatus });

  const insert = {
    name,
    phone,
    account_id,
    campaign_id: null,
    contact_data: {}, // vazio no momento da criação
    external_code: String(extId),
    external_status: extStatus ? String(extStatus) : null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const inserted = await db('contact').insert(insert).returning(['id']);
  console.log('[processContactCart] contact inserted', { id: inserted?.[0]?.id });

  // 4) Criar/atualizar user_session associado
  const contactId = inserted?.[0]?.id;
  const inboxId = Number(payload?.inbox_id ?? payload?.inboxId ?? NaN);
  const conversationId = Number(payload?.conversation_id ?? payload?.conversationId ?? NaN);

  // Obter product_id a partir da account
  const accountRow = await db('account').where({ id: account_id }).select('product_id', 'conversation_funnel_id').first();
  const productId = accountRow?.product_id || null;

  console.log('[processContactCart] upserting user_session', { account_id, phone, contactId, inboxId, conversationId, productId });

  const existingSession = await db('user_session')
    .where({ account_id, phone })
    .first();

  if (existingSession) {
    const updatePayload = {
      updated_at: new Date(),
      contact_id: contactId || existingSession.contact_id || null,
    };
    if (!Number.isNaN(inboxId)) updatePayload.inbox_id = inboxId;
    if (!Number.isNaN(conversationId)) updatePayload.conversation_id = conversationId;

    const [updatedSession] = await db('user_session')
      .where({ id: existingSession.id })
      .update(updatePayload)
      .returning(['id']);
    console.log('[processContactCart] user_session updated', { id: updatedSession?.id });
  } else {
    const newSession = {
      name,
      phone,
      account_id,
      product_id: productId,
      contact_id: contactId || null,
      conversation_funnel_step_id: null, // pode ser null conforme regra
      created_at: new Date(),
      updated_at: new Date(),
    };
    if (!Number.isNaN(inboxId)) newSession.inbox_id = inboxId;
    if (!Number.isNaN(conversationId)) newSession.conversation_id = conversationId;

    const [createdSession] = await db('user_session').insert(newSession).returning(['id']);
    console.log('[processContactCart] user_session created', { id: createdSession?.id });
  }

  return {
    type: 'processing',
    message: 'Estamos realizando fazendo a configuração do seu carrinho, em instantes retornaremos com o link para o checkout'
  };
};

module.exports = { processContactCart };
