const { getDbConnection } = require('../utils/database');
const { getCache, setCache } = require('../utils/cache');
const { formatParameters } = require('../utils/format-parameters');

const listAccountsWithFunnel = async (limit = 50, offset = 0) => {
  const cacheKey = `account-list-with-funnel:${limit}:${offset}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    console.log(
      `Dados encontrados no cache para account-list-with-funnel com limit: ${limit}, offset: ${offset}`,
    );
    return cachedData;
  }

  console.log(
    `Buscando lista de contas com funil no banco de dados com limit: ${limit}, offset: ${offset}`,
  );

  const db = getDbConnection();
  let accounts = [];

  try {
    accounts = await db('account as a')
      .whereNotNull('a.conversation_funnel_id')
      .whereExists(function () {
        this.select(1)
          .from('conversation_funnel_step as s')
          .whereRaw('s.conversation_funnel_id = a.conversation_funnel_id')
          .whereExists(function () {
            this.select(1)
              .from('conversation_funnel_step_message as m')
              .whereRaw('m.conversation_funnel_step_id = s.id');
          });
      })
      .select('a.*')
      .limit(limit)
      .offset(offset)
      .orderBy('a.created_at', 'desc');

    if (!accounts || accounts.length === 0) {
      console.log('Nenhuma conta com funil encontrada');
      return [];
    }

    const result = await Promise.all(
      accounts.map(async (account) => {
        const accountId = account.id;
        const productId = account.product_id;

        const accountParameters = await db('account_parameter')
          .where('account_id', accountId)
          .select('*');

        let product = null;
        let productParameters = [];

        if (productId) {
          const products = await db('product').where('id', productId).select('*');

          if (products && products.length > 0) {
            product = products[0];

            productParameters = await db('product_parameter')
              .where('product_id', productId)
              .select('*');
          }
        }

        const accountParams = formatParameters(accountParameters);
        const productParams = formatParameters(productParameters);

        return {
          account,
          product,
          ...accountParams,
          ...productParams,
        };
      }),
    );

    console.log(`Armazenando resultado no cache com chave: ${cacheKey}`);
    await setCache(cacheKey, result, 300);

    return result;
  } catch (error) {
    console.error('Erro ao listar contas com funil:', error);
    throw new Error(`Erro ao listar contas com funil: ${error.message}`);
  }
};

module.exports = {
  listAccountsWithFunnel,
};
