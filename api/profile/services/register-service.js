const { getDbConnection } = require('../utils/database');

const DEFAULT_ACCESS_PROFILE_ID = 'e8cbb607-4a3a-44c6-8669-a5c6d2bd5e17';

const normalizeDomain = (domain) => {
  if (!domain) return domain;
  const withoutProtocol = domain.replace(/^https?:\/\//i, '');
  return withoutProtocol.replace(/\/$/, '');
};

// Regras de resolução de domínio para lookup de company:
// 1 - localhost = autonomia
// 2 - portal.<DOMINIO>.xxx = <DOMINIO>
// 3 - <SUBDOMINIO>.autonomia.site = <SUBDOMINIO>
// 4 - Qualquer outro padrão = autonomia
// Quando o valor não contém ponto (ex: "autonomia", "hub2you"), assume-se que já é o slug correto.
const resolveCompanyDomainForLookup = (inputDomain) => {
  if (!inputDomain) {
    return 'autonomia';
  }

  // Primeiro normaliza removendo protocolo, path, query, fragmento e porta
  const withoutProtocol = inputDomain.replace(/^https?:\/\//i, '');
  const hostnamePart = withoutProtocol.split('/')[0].split('?')[0].split('#')[0];
  const hostname = hostnamePart.split(':')[0].toLowerCase();

  if (!hostname) {
    return 'autonomia';
  }

  // Se não há ponto, consideramos que já é o slug correto (ex: "autonomia", "hub2you")
  if (!hostname.includes('.')) {
    return hostname;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'autonomia';
  }

  if (hostname.startsWith('portal.')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[1];
    }
    return 'autonomia';
  }

  if (hostname.endsWith('.autonomia.site')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
    return 'autonomia';
  }

  return 'autonomia';
};

const ensureUserCompany = async (transaction, userId, companyId) => {
  if (!companyId) return;
  const hasCompany = await transaction('user_company')
    .where({ user_id: userId, company_id: companyId })
    .first();
  if (hasCompany) return;
  await transaction('user_company').insert({ user_id: userId, company_id: companyId });
};

const ensureUserProfile = async (transaction, userId, profileId) => {
  if (!profileId) return;
  const profile = await transaction('access_profiles').where({ id: profileId }).first();
  if (!profile) return;
  const hasProfile = await transaction('user_access_profiles')
    .where({ user_id: userId, access_profile_id: profile.id })
    .first();
  if (hasProfile) return;
  await transaction('user_access_profiles').insert({
    user_id: userId,
    access_profile_id: profile.id,
  });
};

const ensureUserAccountsForLinkNewUser = async (transaction, userId, companyId) => {
  if (!companyId) return;
  const productIds = await transaction('product').where({ company_id: companyId }).pluck('id');
  if (!Array.isArray(productIds) || productIds.length === 0) return;

  const linkProducts = await transaction('product_parameter')
    .whereIn('product_id', productIds)
    .andWhere({ name: 'link_new_user', value: 'TRUE' })
    .pluck('product_id');
  if (!Array.isArray(linkProducts) || linkProducts.length === 0) return;

  const accountIds = await transaction('account').whereIn('product_id', linkProducts).pluck('id');
  if (!Array.isArray(accountIds) || accountIds.length === 0) return;

  for (const accountId of accountIds) {
    const hasAccount = await transaction('user_accounts')
      .where({ user_id: userId, account_id: accountId })
      .first();
    if (hasAccount) continue;
    await transaction('user_accounts').insert({ user_id: userId, account_id: accountId });
  }
};

const ensureExistingUserAssociations = async (
  transaction,
  existingUser,
  companyId,
  access_profile_id
) => {
  const userId = existingUser.id;
  const profileId = DEFAULT_ACCESS_PROFILE_ID || access_profile_id;

  await ensureUserCompany(transaction, userId, companyId);
  await ensureUserProfile(transaction, userId, profileId);
  await ensureUserAccountsForLinkNewUser(transaction, userId, companyId);
};

const linkNewUserToCompany = async (transaction, newUser, companyId) => {
  if (!companyId) return;
  await transaction('user_company').insert({
    user_id: newUser.id,
    company_id: companyId,
  });
};

const linkNewUserToProfile = async (transaction, newUser, access_profile_id) => {
  const profileId = DEFAULT_ACCESS_PROFILE_ID || access_profile_id;
  if (!profileId) return;

  const profile = await transaction('access_profiles').where({ id: profileId }).first();
  if (!profile) {
    throw new Error(`Perfil de acesso não encontrado (ID: ${profileId}).`);
  }
  await transaction('user_access_profiles').insert({
    user_id: newUser.id,
    access_profile_id: profile.id,
  });
};

const linkNewUserToAccountsForLinkNewUser = async (transaction, newUser, companyId) => {
  if (!companyId) return;
  const productIds = await transaction('product').where({ company_id: companyId }).pluck('id');
  if (!Array.isArray(productIds) || productIds.length === 0) return;

  const linkProducts = await transaction('product_parameter')
    .whereIn('product_id', productIds)
    .andWhere({ name: 'link_new_user', value: 'TRUE' })
    .pluck('product_id');
  if (!Array.isArray(linkProducts) || linkProducts.length === 0) return;

  const accountIds = await transaction('account').whereIn('product_id', linkProducts).pluck('id');
  if (!Array.isArray(accountIds) || accountIds.length === 0) return;

  const rows = accountIds.map((accountId) => ({
    user_id: newUser.id,
    account_id: accountId,
  }));
  await transaction('user_accounts').insert(rows);
};

const getCompanyIdByDomain = async (knex, domain) => {
  try {
    const resolvedDomain = resolveCompanyDomainForLookup(domain);
    const normalizedDomain = normalizeDomain(resolvedDomain);

    let company = await knex('company').where({ domain: normalizedDomain }).first();
    if (!company) {
      company = await knex('company').where({ domain: resolvedDomain }).first();
    }

    if (!company) {
      const candidates = await knex('company')
        .where('domain', 'like', `%${normalizedDomain}%`)
        .orWhere('domain', 'like', `%${resolvedDomain}%`)
        .select('*');

      if (Array.isArray(candidates) && candidates.length === 1) {
        company = candidates[0];
      }

      if (Array.isArray(candidates) && candidates.length > 1) {
        const domainsList = candidates.map((c) => c.domain).join(', ');
        throw new Error(
          `Mais de uma empresa encontrada para o domínio: ${domain} (normalizado: ${normalizedDomain}). Domínios encontrados: ${domainsList}`
        );
      }
    }

    if (!company) {
      const existingCompanies = await knex('company')
        .whereNotNull('domain')
        .select('domain')
        .limit(5);
      const domainsList = existingCompanies.map((c) => c.domain).join(', ') || 'nenhum domínio encontrado';
      throw new Error(
        `Nenhuma empresa encontrada para o domínio: ${domain} (normalizado: ${normalizedDomain}). Domínios existentes em company: ${domainsList}`
      );
    }

    return company.id;
  } catch (err) {
    if (err.message && err.message.includes('Nenhuma empresa encontrada')) {
      throw err;
    }
    throw new Error(`Falha ao verificar o domínio da empresa: ${err.message}`);
  }
};

const registerUser = async ({ email, name, phone, domain, access_profile_id }) => {
  const knex = getDbConnection();
  const companyId = await getCompanyIdByDomain(knex, domain);

  return knex.transaction(async (transaction) => {
    const existingUser = await transaction('users').where({ email }).first();
    if (existingUser) {
      await ensureExistingUserAssociations(transaction, existingUser, companyId, access_profile_id);
      return existingUser;
    }

    const [newUser] = await transaction('users')
      .insert({ name, email, phone })
      .returning('*');

    await linkNewUserToCompany(transaction, newUser, companyId);
    await linkNewUserToProfile(transaction, newUser, access_profile_id);
    await linkNewUserToAccountsForLinkNewUser(transaction, newUser, companyId);

    return newUser;
  });
};

module.exports = registerUser;
