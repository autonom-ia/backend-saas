/**
 * Utilitário para gerenciamento de cache com Redis
 */
const Redis = require('ioredis');
let redisClient;

/**
 * Inicializa o cliente Redis
 * @returns {Redis} - Cliente Redis inicializado
 */
const getRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || 6379;
  
  // Só inicializa o Redis se houver um host configurado
  if (host) {
    try {
      redisClient = new Redis({
        host,
        port: parseInt(port, 10),
        connectTimeout: 5000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true
      });
      
      redisClient.on('error', (err) => {
        console.error('Erro na conexão com Redis:', err);
      });
      
      console.log(`Cliente Redis inicializado para ${host}:${port}`);
      return redisClient;
    } catch (err) {
      console.error('Falha ao inicializar Redis:', err);
      return null;
    }
  } else {
    console.log('Redis não configurado, cache desabilitado');
    return null;
  }
};

/**
 * Obtém um valor do cache
 * @param {string} key - Chave do cache
 * @returns {Promise<object|null>} - Valor do cache ou null se não existir
 */
const getCache = async (key) => {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const cachedData = await client.get(key);
    if (cachedData) {
      console.log(`Dados recuperados do cache para chave: ${key}`);
      return JSON.parse(cachedData);
    }
    return null;
  } catch (err) {
    console.error(`Erro ao obter cache para chave ${key}:`, err);
    return null;
  }
};

/**
 * Armazena um valor no cache
 * @param {string} key - Chave do cache
 * @param {object} value - Valor a ser armazenado
 * @param {number} ttl - Tempo de vida em segundos (opcional)
 * @returns {Promise<boolean>} - true se foi armazenado com sucesso
 */
const setCache = async (key, value, ttl) => {
  const client = getRedisClient();
  if (!client) return false;
  
  const ttlSeconds = ttl || parseInt(process.env.CACHE_TTL || 300, 10);
  
  try {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, stringValue);
    } else {
      await client.set(key, stringValue);
    }
    console.log(`Dados armazenados no cache para chave: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (err) {
    console.error(`Erro ao armazenar cache para chave ${key}:`, err);
    return false;
  }
};

/**
 * Remove um valor do cache
 * @param {string} key - Chave do cache
 * @returns {Promise<boolean>} - true se foi removido com sucesso
 */
const invalidateCache = async (key) => {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    await client.del(key);
    console.log(`Cache invalidado para chave: ${key}`);
    return true;
  } catch (err) {
    console.error(`Erro ao invalidar cache para chave ${key}:`, err);
    return false;
  }
};

module.exports = {
  getCache,
  setCache,
  invalidateCache
};
