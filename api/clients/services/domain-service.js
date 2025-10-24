const { getDbConnection } = require('../utils/database');

const ADMIN_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';

const ensureUserIdForNonAdmin = (isAdmin, userId) => {
  if (isAdmin) return;
  if (userId) return;
  throw new Error('userId is required for non-admin queries');
};

const buildDomainQuery = (db, { isAdmin, userId }) => {
  ensureUserIdForNonAdmin(isAdmin, userId);

  const baseQuery = db('account')
    .distinct({ domain: 'account.domain' })
    .whereNotNull('account.domain')
    .where('account.domain', '<>', '')
    .orderBy('account.domain', 'asc');

  if (isAdmin) return baseQuery;

  return baseQuery
    .join('user_accounts as ua', 'ua.account_id', 'account.id')
    .where('ua.user_id', userId);
};

const mapDomains = (rows) => rows.map((row) => row.domain);

const getAccessibleAccountDomains = async ({ userId, isAdmin }) => {
  const db = getDbConnection();
  const query = buildDomainQuery(db, { isAdmin, userId });
  const rows = await query;
  return mapDomains(rows);
};

/**
 * Alto nível: obtém domínios acessíveis a partir de um userId, resolvendo isAdmin internamente.
 * Mantém o padrão de handlers finos (sem acesso direto a DB) como em get-messages.
 */
const listAccessibleDomainsByUserId = async (userId) => {
  const db = getDbConnection();
  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    const err = new Error('Usuário não encontrado');
    err.statusCode = 404;
    throw err;
  }
  const profileIds = await db('user_access_profiles')
    .where({ user_id: userId })
    .pluck('access_profile_id');
  const isAdmin = Array.isArray(profileIds) && profileIds.includes(ADMIN_PROFILE_ID);
  const rows = await buildDomainQuery(db, { isAdmin, userId });
  return mapDomains(rows);
};

const resolveAccessContext = async (db, email) => {
  const user = await db('users').where({ email }).first();
  if (!user) return { user: null, isAdmin: false };

  const profileIds = await db('user_access_profiles')
    .where({ user_id: user.id })
    .pluck('access_profile_id');

  const isAdmin = Array.isArray(profileIds) && profileIds.includes(ADMIN_PROFILE_ID);
  return { user, isAdmin };
};

module.exports = {
  ADMIN_PROFILE_ID,
  buildDomainQuery,
  ensureUserIdForNonAdmin,
  getAccessibleAccountDomains,
  mapDomains,
  resolveAccessContext,
  listAccessibleDomainsByUserId,
};
