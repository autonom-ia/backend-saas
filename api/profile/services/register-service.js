
const { getDbConnection } = require('../utils/database');

/**
 * Normaliza o domínio removendo protocolo e trailing slash
 * @param {string} domain - Domínio a ser normalizado
 * @returns {string} Domínio normalizado
 */
const normalizeDomain = (domain) => {
  if (!domain) return domain;
  
  // Remove protocolo (http://, https://)
  let normalized = domain.replace(/^https?:\/\//i, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
};

const registerUser = async ({ email, name, phone, domain, access_profile_id }) => {
  const knex = getDbConnection();
  let accountId;
  let companyId;

  // 1. Encontrar a conta pelo domínio
  try {
    // Normalizar o domínio para buscar (sem protocolo, sem trailing slash)
    const normalizedDomain = normalizeDomain(domain);
    
    // Tentar buscar com o domínio normalizado primeiro
    let account = await knex('account').where({ domain: normalizedDomain }).first();
    
    // Se não encontrar, tentar com o domínio original
    if (!account) {
      account = await knex('account').where({ domain }).first();
    }
    
    // Se ainda não encontrar, tentar buscar por LIKE para casos com/sem protocolo
    if (!account) {
      account = await knex('account')
        .where('domain', 'like', `%${normalizedDomain}%`)
        .orWhere('domain', 'like', `%${domain}%`)
        .first();
    }
    
    if (!account) {
      // Listar alguns domínios existentes para ajudar no debug
      const existingDomains = await knex('account')
        .whereNotNull('domain')
        .select('domain')
        .limit(5);
      
      const domainsList = existingDomains.map(a => a.domain).join(', ') || 'nenhum domínio encontrado';
      
      throw new Error(`Nenhuma conta encontrada para o domínio: ${domain} (normalizado: ${normalizedDomain}). Domínios existentes no banco: ${domainsList}`);
    }
    accountId = account.id;

    // Descobrir a company relacionada via product.company_id
    if (account.product_id) {
      const product = await knex('product').where({ id: account.product_id }).first();
      if (product && product.company_id) {
        companyId = product.company_id;
      }
    }
  } catch (err) {
    console.error('Erro ao procurar a conta:', err);
    // Retornar a mensagem de erro original se for mais específica
    if (err.message && err.message.includes('Nenhuma conta encontrada')) {
      throw err;
    }
    throw new Error(`Falha ao verificar o domínio da conta: ${err.message}`);
  }

  // 2. Criar o utilizador e as associações numa transação 
  // Incluido para o deploy
    return knex.transaction(async (transaction) => {
    // Inserir na tabela 'user'
        const [newUser] = await transaction('users')
      .insert({
        name,
        email,
        phone,
      })
      .returning('*');

    // Associar utilizador à empresa, se identificada
    if (companyId) {
      await transaction('user_company').insert({
        user_id: newUser.id,
        company_id: companyId,
      });
    }

    // Adicionar perfil de acesso padrão (se fornecido)
    if (access_profile_id) {
      const profile = await transaction('access_profiles').where({ id: access_profile_id }).first();
      
      if (!profile) {
        throw new Error(`Perfil de acesso não encontrado (ID: ${access_profile_id}).`);
      }
      
        await transaction('user_access_profiles').insert({
      user_id: newUser.id,
        access_profile_id: profile.id,
    });
    }

    return newUser;
  });
};

module.exports = registerUser;
