const knex = require('knex');

let connection = null;

/**
 * Obtém uma conexão com o banco de dados
 */
const getDbConnection = () => {
  if (connection) {
    return connection;
  }

  const config = {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL_ENABLED === 'true'
    },
    pool: {
      min: 0,
      max: 7
    }
  };

  connection = knex(config);
  return connection;
};

module.exports = {
  getDbConnection
};
