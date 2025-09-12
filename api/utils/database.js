/**
 * Utilitário para conexão e operações com o banco de dados
 */
const knex = require('knex');

let dbInstance;

/**
 * Inicializa uma conexão com o banco de dados
 * @returns {object} - Instância do Knex inicializada
 */
const getDbConnection = () => {
  if (dbInstance) {
    return dbInstance;
  }

  // Configuração da conexão com o banco de dados a partir de variáveis de ambiente
  const config = {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 0,
      max: 7,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000
    },
    debug: process.env.NODE_ENV === 'development'
  };

  try {
    dbInstance = knex(config);
    console.log(`Conexão com o banco de dados inicializada para ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    return dbInstance;
  } catch (err) {
    console.error('Erro ao inicializar a conexão com o banco de dados:', err);
    throw err;
  }
};

/**
 * Fecha a conexão com o banco de dados
 */
const closeDbConnection = async () => {
  if (dbInstance) {
    try {
      await dbInstance.destroy();
      dbInstance = null;
      console.log('Conexão com o banco de dados fechada');
    } catch (err) {
      console.error('Erro ao fechar a conexão com o banco de dados:', err);
    }
  }
};

module.exports = {
  getDbConnection,
  closeDbConnection
};
