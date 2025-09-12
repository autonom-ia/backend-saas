/**
 * Utilitários para administração do cache Redis
 */
const Redis = require('ioredis');

let redisClient = null;

/**
 * Obtém uma conexão com o Redis
 * @returns {Object} Cliente Redis
 */
const getRedisClient = () => {
  if (redisClient) return redisClient;
  
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT || 6379;
  
  if (!redisHost) {
    throw new Error('Variável de ambiente REDIS_HOST não definida');
  }
  
  console.log(`Conectando ao Redis em ${redisHost}:${redisPort}`);
  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    connectTimeout: 10000,
    maxRetriesPerRequest: 3
  });
  
  redisClient.on('error', (err) => {
    console.error('Erro na conexão com Redis:', err);
  });
  
  return redisClient;
};

/**
 * Limpa uma chave específica do cache
 * @param {string} key - Chave a ser limpa
 * @returns {Promise<boolean>} - Verdadeiro se a chave foi removida
 */
const clearCache = async (key) => {
  try {
    const redis = getRedisClient();
    const result = await redis.del(key);
    return result > 0;
  } catch (err) {
    console.error(`Erro ao limpar cache para chave ${key}:`, err);
    throw err;
  }
};

/**
 * Limpa todas as chaves que correspondem a um padrão
 * @param {string} pattern - Padrão para correspondência (ex: "product-account:*")
 * @returns {Promise<Array>} - Array de chaves removidas
 */
const clearCachePattern = async (pattern) => {
  try {
    const redis = getRedisClient();
    
    // Encontrar todas as chaves que correspondem ao padrão
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }
    
    // Deletar todas as chaves encontradas
    await redis.del(...keys);
    
    return keys;
  } catch (err) {
    console.error(`Erro ao limpar cache para padrão ${pattern}:`, err);
    throw err;
  }
};

/**
 * Fecha a conexão com Redis
 */
const closeRedisConnection = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

module.exports = {
  clearCache,
  clearCachePattern,
  closeRedisConnection
};
