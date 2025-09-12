/**
 * Serviço para listar contas com produtos e parâmetros formatados
 */
const { getDbConnection } = require('../utils/database');
const { getCache, setCache } = require('../utils/cache');
const { formatParameters } = require('../utils/format-parameters');

/**
 * Lista todas as contas com seus produtos e parâmetros formatados
 * @param {number} limit - Limite de registros a retornar (opcional)
 * @param {number} offset - Offset para paginação (opcional)
 * @returns {Promise<Array>} - Lista de contas com produtos e parâmetros formatados
 */
const listAccounts = async (limit = 50, offset = 0) => {
  // Verificar cache primeiro
  const cacheKey = `account-list:${limit}:${offset}`;
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    console.log(`Dados encontrados no cache para account-list com limit: ${limit}, offset: ${offset}`);
    return cachedData;
  }

  console.log(`Buscando lista de contas no banco de dados com limit: ${limit}, offset: ${offset}`);
  
  const db = getDbConnection();
  let accounts = [];
  let result = [];

  try {
    // 1. Buscar todas as contas com paginação
    accounts = await db('account')
      .select('*')
      .limit(limit)
      .offset(offset)
      .orderBy('created_at', 'desc');

    if (!accounts || accounts.length === 0) {
      console.log('Nenhuma conta encontrada');
      return [];
    }

    // 2. Para cada conta, buscar produto e parâmetros
    result = await Promise.all(accounts.map(async (account) => {
      const accountId = account.id;
      const productId = account.product_id;
      
      // Buscar parâmetros da conta
      const accountParameters = await db('account_parameter')
        .where('account_id', accountId)
        .select('*');
      
      let product = null;
      let productParameters = [];
      
      // Se tiver product_id, buscar o produto e seus parâmetros
      if (productId) {
        const products = await db('product')
          .where('id', productId)
          .select('*');
          
        if (products && products.length > 0) {
          product = products[0];
          
          // Buscar parâmetros do produto
          productParameters = await db('product_parameter')
            .where('product_id', productId)
            .select('*');
        }
      }
      
      // Formatar os parâmetros de array para objeto
      const accountParams = formatParameters(accountParameters);
      const productParams = formatParameters(productParameters);
      
      // Estruturar resposta com os parâmetros diretamente na raiz
      return {
        account,
        product,
        ...accountParams,   // Parâmetros da conta diretamente na raiz
        ...productParams    // Parâmetros do produto diretamente na raiz
      };
    }));

    // Armazenar no cache por 5 minutos (tempo menor para lista que pode mudar com frequência)
    console.log(`Armazenando resultado no cache com chave: ${cacheKey}`);
    await setCache(cacheKey, result, 300); // 300 segundos = 5 minutos

    return result;
  } catch (error) {
    console.error('Erro ao listar contas:', error);
    throw new Error(`Erro ao listar contas: ${error.message}`);
  }
};

module.exports = {
  listAccounts
};
