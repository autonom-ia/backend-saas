/**
 * Serviço para buscar dados de produtos e contas
 */
const { getDbConnection } = require('../utils/database');
const { getCache, setCache } = require('../utils/cache');
const { formatParameters } = require('../utils/format-parameters');

function getValueFromPath(obj, path) {
  try {
    return path
      .split(/[\.\[\]\'\"]/)
      .filter(p => p)
      .reduce((o, p) => o[p], obj);
  } catch (e) {
    return undefined;
  }
}

function valueToString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value.toString();
}

function replaceVariables(text, data) {
  const regex = /\$[a-zA-Z0-9_.\[\]]+/g;
  const matches = text.match(regex);
  if (matches) {
    matches.forEach(variable => {
      const path = variable.slice(1);
      const value = getValueFromPath(data, path);
      const valueStr = valueToString(value);
      text = text.split(variable).join(valueStr);
    });
  }
  return text;
}

async function buildAgentInstructions(db, product, accountId) {
  if (!product) return '';
  const blocks = [];

  const collator = new Intl.Collator('pt-BR', {
    numeric: true,
    sensitivity: 'base',
  });

  const items = [];

  if (product.product_type_id) {
    const rows = await db('product_type_instruction')
      .where('product_type_id', product.product_type_id)
      .select('code', 'description', 'instruction');

    for (const r of rows) {
      items.push({
        source: 'product_type_instruction',
        code: r.code || '',
        description: r.description || '',
        content: r.instruction || '',
      });
    }
  }

  const prompts = await db('agent_prompts')
    .where({ product_id: product.id, is_deleted: false, is_active: true });

  for (const prompt of prompts) {
    items.push({
      source: 'agent_prompt',
      code: prompt.code || '',
      title: prompt.title || '',
      content: prompt.content || '',
    });
  }

  const sortedItems = items.sort((a, b) => {
    const codeA = a.code || '';
    const codeB = b.code || '';
    return collator.compare(codeA, codeB);
  });

  for (const item of sortedItems) {
    const code = item.code || '';
    const desc = item.description || '';
    const titleFromPrompt = item.title || '';

    let header = '';
    if (item.source === 'product_type_instruction') {
      header = code && desc ? `${code} - ${desc}` : (code || desc);
    } else {
      header = titleFromPrompt || code;
    }

    const title = header ? `### ${header}` : '###';
    const content = item.content || '';
    blocks.push(`${title}\n${content}`.trim());
  }

  if (accountId) {
    const integrations = await db('account_integration_api')
      .where({ account_id: accountId, is_active: true })
      .orderBy('created_at', 'asc');

    for (const integration of integrations) {
      const integrationTitle = integration.name ? `### Integração: ${integration.name}` : '### Integração';
      const integrationInstr = integration.agent_instruction || '';

      const fields = await db('account_integration_api_field')
        .where('account_integration_api_id', integration.id)
        .orderBy('sort_order', 'asc');

      const fieldLines = fields.map((field) => {
        const key = field.api_field_key || '';
        const label = field.user_label || '';
        const desc = field.user_description || '';
        const auto = field.auto_fill_document_type || '';
        const parts = [];
        if (key) parts.push(key);
        if (label) parts.push(`label: ${label}`);
        if (desc) parts.push(`descrição: ${desc}`);
        if (auto) parts.push(`auto-preenchido por: ${auto}`);
        return `- ${parts.join(' | ')}`.trim();
      });

      const fieldsBlock = fieldLines.length ? ['Campos:', ...fieldLines].join('\n') : '';
      const blockParts = [integrationTitle, integrationInstr, fieldsBlock].filter(Boolean);
      blocks.push(blockParts.join('\n\n').trim());
    }
  }

  return blocks.filter(Boolean).join('\n\n');
}

/**
 * Busca dados de produtos e contas pelo número de telefone e telefone da conta
 * @param {string} phone - Telefone do usuário para buscar sessões
 * @param {string} accountPhone - Telefone da conta para filtrar
 * @returns {Promise<Object>} - Dados estruturados
 */
const getProductAccountByTwoPhones = async (phone, accountPhone) => {
  if (!phone || !accountPhone) {
    throw new Error('Ambos os telefones são obrigatórios para consulta');
  }

  // Verificar cache primeiro
  const cacheKey = `product-account:${phone}:${accountPhone}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    console.log(`Dados encontrados no cache para phone: ${phone}, accountPhone: ${accountPhone}`);
    return cachedData;
  }

  console.log(`Buscando no banco de dados para phone: ${phone}, accountPhone: ${accountPhone}`);
  
  const db = getDbConnection();
  let userSessions = [];
  let accounts = [];
  let products = [];
  let productParameters = [];
  let accountParameters = [];

  try {
    // 1. Tentar encontrar a conta via inbox.name
    console.log(`Buscando inbox pelo nome (usando accountPhone): ${accountPhone}`);
    const inbox = await db('inbox')
      .where('name', accountPhone)
      .select('account_id')
      .first();

    if (inbox && inbox.account_id) {
      // Se encontrou no inbox, busca a conta pelo ID
      console.log(`Inbox encontrado. Buscando conta pelo account_id: ${inbox.account_id}`);
      accounts = await db('account')
        .where('id', inbox.account_id)
        .select('*');
    } else {
      // 2. Se não encontrar no inbox, buscar a conta pelo accountPhone (fluxo original)
      console.log(`Nenhum inbox encontrado. Buscando conta pelo accountPhone: ${accountPhone}`);
      accounts = await db('account')
        .where('phone', accountPhone)
        .select('*');
    }

    if (!accounts || accounts.length === 0) {
      console.log(`Nenhuma conta encontrada para accountPhone: ${accountPhone}`);
      return {
        userSessions: [],
        accounts: [],
        products: []
        // Sem parâmetros para retornar pois não encontrou conta
      };
    }

    // Extrair account_id e product_id da conta encontrada
    const accountId = accounts[0].id;
    const productId = accounts[0].product_id;
    console.log(`Conta encontrada - ID: ${accountId}, Product ID: ${productId}`);

    // 2. Buscar parâmetros da conta
    console.log(`Buscando parâmetros da conta ID: ${accountId}`);
    accountParameters = await db('account_parameter')
      .where('account_id', accountId)
      .select('*');

    // 3. Se tiver product_id, buscar o produto e seus parâmetros
    if (productId) {
      console.log(`Buscando produto ID: ${productId}`);
      products = await db('product')
        .where('id', productId)
        .select('*');

      console.log(`Buscando parâmetros do produto ID: ${productId}`);
      productParameters = await db('product_parameter')
        .where('product_id', productId)
        .select('*');
    }

    // 4. Buscar sessões do usuário pelo phone e account_id
    console.log(`Buscando sessões com phone: ${phone} e account_id: ${accountId}`);
    userSessions = await db('user_session')
      .where('phone', phone)
      .where('account_id', accountId)
      .select('*');

    // 4.1. Se não existir user_session, criar agora
    if (!userSessions || userSessions.length === 0) {
      console.log('Nenhuma user_session encontrada. Criando nova sessão...');
      const insertData = {
        account_id: accountId,
        phone,
        // opcional: atrelar produto da conta se existir
        product_id: products && products[0] ? products[0].id : productId || null,
      };
      const [createdSession] = await db('user_session')
        .insert(insertData)
        .returning('*');
      if (createdSession) {
        userSessions = [createdSession];
        console.log('user_session criada com sucesso:', createdSession.id);
      } else {
        console.warn('Falha ao criar user_session. Prosseguindo sem sessão.');
      }
    }

    // Formatar os parâmetros de array para objeto e colocá-los diretamente na raiz
    const accountParams = formatParameters(accountParameters);
    const productParams = formatParameters(productParameters);
    
    // Merge inteligente: se o mesmo parâmetro existir em conta e produto,
    // prioriza o que estiver preenchido (não nulo/não string vazia).
    const mergeParamsPreferFilled = (accParams, prodParams) => {
      const keys = new Set([
        ...Object.keys(accParams || {}),
        ...Object.keys(prodParams || {})
      ]);
      const result = {};
      for (const key of keys) {
        const a = accParams ? accParams[key] : undefined;
        const p = prodParams ? prodParams[key] : undefined;
        const hasA = a !== undefined && a !== null && String(a).trim() !== '';
        const hasP = p !== undefined && p !== null && String(p).trim() !== '';
        // Preferir valor da account quando preenchido; caso contrário, usar o do produto
        result[key] = hasA ? a : (hasP ? p : (a !== undefined ? a : p));
      }
      return result;
    };
    const mergedParams = mergeParamsPreferFilled(accountParams, productParams);

    const integrations = await db('account_integration_api')
      .where({ account_id: accountId })
      .orderBy('created_at', 'asc')
      .select('id', 'slug', 'agent_instruction');

    const product = products && products[0] ? products[0] : null;
    const rawAgentInstructions = await buildAgentInstructions(db, product, accountId);

    const productAccountSettings = {
      product_account_settings: {
        accounts,
        products,
        ...mergedParams
      }
    };
    let knowledgeBase = mergedParams && mergedParams.knowledgeBase !== undefined ? mergedParams.knowledgeBase : {};
    if (typeof knowledgeBase === 'string') {
      try { knowledgeBase = JSON.parse(knowledgeBase); } catch (_) { knowledgeBase = {}; }
    }
    const data = knowledgeBase || {};

    const hasParamAgentInstructions = mergedParams &&
      mergedParams.agent_instructions !== undefined &&
      mergedParams.agent_instructions !== null &&
      String(mergedParams.agent_instructions).trim() !== '';

    const baseInstructionsText = hasParamAgentInstructions
      ? String(mergedParams.agent_instructions)
      : (rawAgentInstructions || '');

    const outputText = replaceVariables(baseInstructionsText, data);

    const filteredMergedParams = Object.fromEntries(
      Object.entries(mergedParams || {}).filter(([k]) => !k.endsWith('_instructions'))
    );

    // Extrair campos da knowledgeBase (quando em formato objeto) para a raiz da resposta,
    // sem sobrescrever parâmetros já existentes em filteredMergedParams.
    const knowledgeBaseFields =
      knowledgeBase && typeof knowledgeBase === 'object' && !Array.isArray(knowledgeBase)
        ? Object.fromEntries(
            Object.entries(knowledgeBase).filter(([key]) => !(key in filteredMergedParams))
          )
        : {};
    
    // Estruturar resposta com os parâmetros diretamente na raiz
    const result = {
      userSessions,
      accounts,
      products,
      agent_instructions: outputText,
      account_integrations: integrations,
      ...filteredMergedParams,
      ...knowledgeBaseFields
    };

    // Armazenar no cache apenas se houver sessões de usuário
    if (result.userSessions && result.userSessions.length > 0) {
      console.log(`Armazenando resultado no cache com chave: ${cacheKey}`);
      await setCache(cacheKey, result);
    } else {
      console.log(`Não armazenando no cache pois não foram encontradas user_sessions.`);
    }

    return result;
  } catch (error) {
    console.error('Erro ao buscar dados de produtos e contas:', error);
    throw new Error(`Erro ao buscar dados: ${error.message}`);
  }
};

/**
 * Busca dados de produtos e contas pelo número de telefone
 * @param {string} phone - Número de telefone para filtrar
 * @returns {Promise<Object>} - Dados estruturados
 * @deprecated Use getProductAccountByTwoPhones para a nova lógica
 */
const getProductAccountByPhone = async (phone) => {
  if (!phone) {
    throw new Error('Telefone é obrigatório para consulta');
  }

  // Verificar cache primeiro
  const cacheKey = `product-account:${phone}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const db = getDbConnection();
  let userSessions = [];
  let accounts = [];
  let products = [];
  let productParameters = [];
  let accountParameters = [];

  try {
    // 1. Buscar todas as sessões do usuário pelo telefone
    userSessions = await db('user_session')
      .where('phone', phone)
      .select('*');

    if (!userSessions || userSessions.length === 0) {
      return {
        userSessions: [],
        accounts: [],
        products: []
        // Sem parâmetros para retornar pois não encontrou sessões
      };
    }

    // Extrair IDs relevantes para as próximas consultas
    const accountIds = [...new Set(userSessions.map(session => session.account_id).filter(Boolean))];
    const productIds = [...new Set(userSessions.map(session => session.product_id).filter(Boolean))];

    // 2. Buscar contas relacionadas
    if (accountIds.length > 0) {
      accounts = await db('account')
        .whereIn('id', accountIds)
        .select('*');
    }

    // 3. Buscar produtos relacionados
    if (productIds.length > 0) {
      products = await db('product')
        .whereIn('id', productIds)
        .select('*');
    }

    // 4. Buscar parâmetros de produtos
    if (productIds.length > 0) {
      productParameters = await db('product_parameter')
        .whereIn('product_id', productIds)
        .select('*');
    }

    // 5. Buscar parâmetros de contas
    if (accountIds.length > 0) {
      accountParameters = await db('account_parameter')
        .whereIn('account_id', accountIds)
        .select('*');
    }

    // Formatar os parâmetros de array para objeto e colocá-los diretamente na raiz
    const accountParams = formatParameters(accountParameters);
    const productParams = formatParameters(productParameters);
    
    // Estruturar resposta com os parâmetros diretamente na raiz
    const result = {
      userSessions,
      accounts,
      products,
      ...accountParams,   // Parâmetros da conta diretamente na raiz
      ...productParams    // Parâmetros do produto diretamente na raiz
    };

    // Armazenar no cache
    await setCache(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Erro ao buscar dados de produtos e contas:', error);
    throw new Error(`Erro ao buscar dados: ${error.message}`);
  }
};

/**
 * Busca dados de produto e conta apenas pelo telefone da conta, sem retornar sessões de usuário
 * @param {string} accountPhone - Telefone da conta para buscar
 * @returns {Promise<Object>} - Dados estruturados sem as sessões de usuário
 */
const getProductAccountbyAccountPhone = async (accountPhone) => {
  if (!accountPhone) {
    throw new Error('Telefone da conta é obrigatório para consulta');
  }

  // Verificar cache primeiro
  const cacheKey = `product-account-by-phone:${accountPhone}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    console.log(`Dados encontrados no cache para accountPhone: ${accountPhone}`);
    return cachedData;
  }

  console.log(`Buscando no banco de dados para accountPhone: ${accountPhone}`);
  
  const db = getDbConnection();
  let accounts = [];
  let products = [];
  let productParameters = [];
  let accountParameters = [];

  try {
    // 1. Buscar a conta pelo accountPhone
    console.log(`Buscando conta pelo accountPhone: ${accountPhone}`);
    accounts = await db('account')
      .where('phone', accountPhone)
      .select('*');

    // 1.1. Se não encontrar na tabela account, tentar buscar no inbox
    if (!accounts || accounts.length === 0) {
      console.log(`Nenhuma conta encontrada pelo phone. Tentando buscar inbox pelo nome: ${accountPhone}`);
      const inbox = await db('inbox')
        .where('name', accountPhone)
        .select('account_id')
        .first();

      if (inbox && inbox.account_id) {
        // Se encontrou no inbox, busca a conta pelo ID
        console.log(`Inbox encontrado. Buscando conta pelo account_id: ${inbox.account_id}`);
        accounts = await db('account')
          .where('id', inbox.account_id)
          .select('*');
      }
    }

    if (!accounts || accounts.length === 0) {
      console.log(`Nenhuma conta encontrada para accountPhone: ${accountPhone}`);
      return {
        accounts: [],
        products: []
      };
    }

    // Extrair account_id e product_id da conta encontrada
    const accountId = accounts[0].id;
    const productId = accounts[0].product_id;
    console.log(`Conta encontrada - ID: ${accountId}, Product ID: ${productId}`);

    // 2. Buscar parâmetros da conta
    console.log(`Buscando parâmetros da conta ID: ${accountId}`);
    accountParameters = await db('account_parameter')
      .where('account_id', accountId)
      .select('*');

    // 3. Se tiver product_id, buscar o produto e seus parâmetros
    if (productId) {
      console.log(`Buscando produto ID: ${productId}`);
      products = await db('product')
        .where('id', productId)
        .select('*');

      console.log(`Buscando parâmetros do produto ID: ${productId}`);
      productParameters = await db('product_parameter')
        .where('product_id', productId)
        .select('*');
    }

    // Formatar os parâmetros de array para objeto e colocá-los diretamente na raiz
    const accountParams = formatParameters(accountParameters);
    const productParams = formatParameters(productParameters);
    
    // Estruturar resposta com os parâmetros diretamente na raiz, sem incluir userSessions
    const result = {
      accounts,
      products,
      ...accountParams,   // Parâmetros da conta diretamente na raiz
      ...productParams    // Parâmetros do produto diretamente na raiz
    };

    // Armazenar no cache
    console.log(`Armazenando resultado no cache com chave: ${cacheKey}`);
    await setCache(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Erro ao buscar dados de produtos e contas:', error);
    throw new Error(`Erro ao buscar dados: ${error.message}`);
  }
};

module.exports = {
  getProductAccountByPhone,
  getProductAccountByTwoPhones,
  getProductAccountbyAccountPhone
};
