
const { getDbConnection } = require('../utils/database');

// Perfil padrão para novos usuários (ver dívida técnica para remover ID fixo)
const DEFAULT_ACCESS_PROFILE_ID = 'e8cbb607-4a3a-44c6-8669-a5c6d2bd5e17';

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
  let companyId;

  // 1. Encontrar a empresa (company) pelo domínio informado
  try {
    const normalizedDomain = normalizeDomain(domain);
    
    let company = await knex('company').where({ domain: normalizedDomain }).first();
    if (!company) {
      company = await knex('company').where({ domain }).first();
    }
    if (!company) {
      company = await knex('company')
        .where('domain', 'like', `%${normalizedDomain}%`)
        .orWhere('domain', 'like', `%${domain}%`)
        .first();
    }
    
    if (!company) {
      const existingCompanies = await knex('company')
        .whereNotNull('domain')
        .select('domain')
        .limit(5);
      const domainsList = existingCompanies.map(c => c.domain).join(', ') || 'nenhum domínio encontrado';
      throw new Error(`Nenhuma empresa encontrada para o domínio: ${domain} (normalizado: ${normalizedDomain}). Domínios existentes em company: ${domainsList}`);
    }
    companyId = company.id;
  } catch (err) {
    console.error('Erro ao procurar a empresa pelo domínio:', err);
    if (err.message && err.message.includes('Nenhuma empresa encontrada')) {
      throw err;
    }
    throw new Error(`Falha ao verificar o domínio da empresa: ${err.message}`);
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

    // 3. Associar perfil de acesso padrão fixo (DEFAULT_ACCESS_PROFILE_ID)
    const profileId = DEFAULT_ACCESS_PROFILE_ID || access_profile_id;
    if (profileId) {
      const profile = await transaction('access_profiles').where({ id: profileId }).first();
      if (!profile) {
        throw new Error(`Perfil de acesso não encontrado (ID: ${profileId}).`);
      }
      await transaction('user_access_profiles').insert({
        user_id: newUser.id,
        access_profile_id: profile.id,
      });
    }

    // 4. Vincular o usuário a contas de produtos marcados com link_new_user = 'TRUE'
    if (companyId) {
      const productIds = await transaction('product')
        .where({ company_id: companyId })
        .pluck('id');
      if (Array.isArray(productIds) && productIds.length) {
        const linkProducts = await transaction('product_parameter')
          .whereIn('product_id', productIds)
          .andWhere({ name: 'link_new_user', value: 'TRUE' })
          .pluck('product_id');
        if (Array.isArray(linkProducts) && linkProducts.length) {
          const accountIds = await transaction('account')
            .whereIn('product_id', linkProducts)
            .pluck('id');
          if (Array.isArray(accountIds) && accountIds.length) {
            const rows = accountIds.map((accountId) => ({
              user_id: newUser.id,
              account_id: accountId,
            }));
            await transaction('user_accounts').insert(rows);
          }
        }
      }
    }

    return newUser;
  });
};

module.exports = registerUser;
