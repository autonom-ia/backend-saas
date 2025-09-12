/**
 * Configuração do Knex para diferentes ambientes
 */

require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'autonomia_admin',
      password: process.env.POSTGRES_PASSWORD || 'autonomia123',
      database: process.env.POSTGRES_DATABASE || 'autonomia_db',
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './shared/migrations/knex',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './shared/migrations/seeds'
    }
  },
  
  staging: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE || 'autonomia_db',
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './shared/migrations/knex',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './shared/migrations/seeds'
    }
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE || 'autonomia_db',
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './shared/migrations/knex',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './shared/migrations/seeds'
    }
  }
};
