/**
 * Sistema de Migrações baseado na API programática do Knex ORM
 * Facilita a execução de migrações via scripts Node.js
 * Suporta múltiplos bancos de dados (default e clients)
 */

const path = require('path');
const knex = require('knex');
const dotenv = require('dotenv');
const fs = require('fs').promises;

// Constantes para os tipos de banco de dados suportados
const DB_TYPES = {
  DEFAULT: 'default',
  CLIENTS: 'clients'
};

/**
 * Função para carregar o knexfile com suporte a múltiplos bancos de dados
 * @param {string} dbType - Tipo de banco de dados (default ou clients)
 * @returns {Object} Configuração do Knex para o ambiente e banco de dados especificados
 */
const loadKnexConfig = (dbType = DB_TYPES.DEFAULT) => {
  try {
    const environment = process.env.NODE_ENV || 'development';
    console.log(`Carregando configuração do Knex para ambiente: ${environment}, banco: ${dbType}`);
    
    // Carregar o knexfile do projeto
    const knexfilePath = path.resolve(__dirname, '../../knexfile');
    console.log(`Carregando knexfile de: ${knexfilePath}`);
    const knexfile = require(knexfilePath);
    
    if (!knexfile || !knexfile[environment]) {
      throw new Error(`Configuração do Knex não encontrada para o ambiente: ${environment}`);
    }
    
    // Criar uma cópia da configuração base
    const config = JSON.parse(JSON.stringify(knexfile[environment]));
    
    // Modificar a configuração com base no tipo de banco de dados
    if (dbType === DB_TYPES.CLIENTS) {
      // Alterar o banco de dados para o banco de clientes
      config.connection.database = process.env.CLIENTS_POSTGRES_DATABASE || 'autonomia_clients';
      
      // Usar credenciais específicas para o banco de dados de clientes, se disponíveis
      config.connection.user = process.env.CLIENTS_POSTGRES_USER || 'autonomia_clients_admin';
      config.connection.password = process.env.CLIENTS_POSTGRES_PASSWORD || config.connection.password;
      
      // Alterar o diretório de migrações e a tabela de controle
      config.migrations.directory = './shared/migrations/knex-clients';
      config.migrations.tableName = 'knex_migrations_clients';
    }
    
    return config;
  } catch (error) {
    console.error('Erro ao carregar configuração do Knex:', error);
    throw error;
  }
};

/**
 * Executa migrações usando a API programática do Knex
 * @param {string} dbType - Tipo de banco de dados (default ou clients)
 * @returns {Object} Resultado da operação
 */
const runMigrations = async (dbType = DB_TYPES.DEFAULT) => {
  try {
    console.log(`Iniciando execução de migrações usando a API do Knex para banco: ${dbType}...`);
    
    const config = loadKnexConfig(dbType);
    console.log('Configuração carregada:', {
      client: config.client,
      migrations: config.migrations,
      connection: {
        host: config.connection.host,
        database: config.connection.database,
        user: config.connection.user
      }
    });
    
    // Criar instância do Knex
    const knexInstance = knex(config);
    
    // Verificar se podemos acessar o banco de dados
    try {
      // Testar a conexão com o banco de dados
      await knexInstance.raw('SELECT 1+1 AS result');
      console.log(`Conexão com o banco ${config.connection.database} estabelecida com sucesso.`);
    } catch (dbError) {
      console.error(`Erro ao conectar ao banco ${config.connection.database}:`, dbError.message);
      await knexInstance.destroy();
      return {
        success: false,
        error: dbError.message,
        message: `Erro ao conectar ao banco ${config.connection.database}`
      };
    }
    
    // Inicializar migrations
    console.log('Executando migrações pendentes...');
    
    let batchNo, log;
    try {
      [batchNo, log] = await knexInstance.migrate.latest();
    } catch (migrationError) {
      // Se o erro for relacionado à tabela de migrações já existir, podemos tentar novamente
      if (migrationError.message.includes('already exists')) {
        console.log('A tabela de migrações já existe. Tentando executar as migrações novamente...');
        try {
          [batchNo, log] = await knexInstance.migrate.latest();
        } catch (retryError) {
          console.error('Erro ao tentar executar migrações novamente:', retryError.message);
          await knexInstance.destroy();
          return {
            success: false,
            error: retryError.message,
            message: `Erro ao executar migrações para banco ${dbType}`
          };
        }
      } else {
        console.error('Erro ao executar migrações:', migrationError.message);
        await knexInstance.destroy();
        return {
          success: false,
          error: migrationError.message,
          message: `Erro ao executar migrações para banco ${dbType}`
        };
      }
    }
    
    if (!log || log.length === 0) {
      console.log('Nenhuma migração pendente encontrada.');
      await knexInstance.destroy();
      return {
        success: true,
        message: 'Nenhuma migração pendente',
        details: { batchNo, migrations: log || [], dbType }
      };
    }
    
    console.log(`Executadas ${log.length} migrações no batch ${batchNo}`);
    console.log('Migrações aplicadas:', log);
    
    // Fechar a conexão após concluir
    await knexInstance.destroy();
    
    return {
      success: true,
      message: `${log.length} migrações aplicadas com sucesso no banco ${dbType}`,
      details: { batchNo, migrations: log, dbType }
    };
    
  } catch (error) {
    console.error(`Erro ao executar migrações para banco ${dbType}:`, error);
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      message: `Erro ao executar migrações para banco ${dbType}`
    };
  }
};

/**
 * Executa rollback da última migração usando a API do Knex
 * @param {string} dbType - Tipo de banco de dados (default ou clients)
 * @returns {Object} Resultado da operação
 */
const rollbackLastMigration = async (dbType = DB_TYPES.DEFAULT) => {
  try {
    console.log(`Iniciando rollback da última migração para banco: ${dbType}...`);
    
    const config = loadKnexConfig(dbType);
    const knexInstance = knex(config);
    
    const [batchNo, log] = await knexInstance.migrate.rollback();
    
    if (log.length === 0) {
      console.log('Nenhuma migração para reverter.');
      await knexInstance.destroy();
      return {
        success: true,
        message: 'Nenhuma migração para reverter',
        details: { batchNo, migrations: log, dbType }
      };
    }
    
    console.log(`Revertidas ${log.length} migrações do batch ${batchNo}`);
    console.log('Migrações revertidas:', log);
    
    await knexInstance.destroy();
    
    return {
      success: true,
      message: `${log.length} migrações revertidas com sucesso no banco ${dbType}`,
      details: { batchNo, migrations: log, dbType }
    };
    
  } catch (error) {
    console.error(`Erro ao fazer rollback da migração para banco ${dbType}:`, error);
    return {
      success: false,
      error: error.message,
      message: `Erro ao fazer rollback da migração para banco ${dbType}`
    };
  }
};

/**
 * Obtém o status das migrações consultando diretamente a tabela de migrações
 * @param {string} dbType - Tipo de banco de dados (default ou clients)
 * @returns {Object} Resultado da operação
 */
const getStatus = async (dbType = DB_TYPES.DEFAULT) => {
  try {
    console.log(`Verificando status das migrações para banco: ${dbType}...`);
    
    const config = loadKnexConfig(dbType);
    const knexInstance = knex(config);
    
    // Determinar o nome da tabela de migrações com base no tipo de banco
    const migrationsTable = dbType === DB_TYPES.CLIENTS ? 'knex_migrations_clients' : 'knex_migrations';
    
    // Verificar se podemos acessar o banco de dados
    try {
      // Testar a conexão com o banco de dados
      await knexInstance.raw('SELECT 1+1 AS result');
      console.log(`Conexão com o banco ${config.connection.database} estabelecida com sucesso.`);
    } catch (dbError) {
      console.error(`Erro ao conectar ao banco ${config.connection.database}:`, dbError.message);
      await knexInstance.destroy();
      return {
        success: false,
        error: dbError.message,
        message: `Erro ao conectar ao banco ${config.connection.database}`
      };
    }
    
    // Verificar a existência da tabela de migrações
    let hasTable = false;
    try {
      hasTable = await knexInstance.schema.hasTable(migrationsTable);
    } catch (tableError) {
      console.error(`Erro ao verificar tabela ${migrationsTable}:`, tableError.message);
    }
    
    if (!hasTable) {
      console.log(`Tabela ${migrationsTable} não existe. Nenhuma migração foi aplicada ainda.`);
      
      // Verificar os arquivos de migração disponíveis no diretório
      const migrationsDir = path.resolve(__dirname, dbType === DB_TYPES.CLIENTS ? './knex-clients' : './knex');
      let pendingMigrations = [];
      
      try {
        pendingMigrations = fs.readdirSync(migrationsDir)
          .filter(file => file.endsWith('.js'))
          .sort();
        console.log(`Encontrados ${pendingMigrations.length} arquivos de migração no diretório ${migrationsDir}`);
      } catch (err) {
        console.log(`Diretório de migrações ${migrationsDir} vazio ou não existe`);
      }
      
      await knexInstance.destroy();
      return {
        success: true,
        message: 'Nenhuma migração aplicada ainda',
        details: {
          completed: [],
          pending: pendingMigrations,
          dbType
        }
      };
    }
    
    // Consultar migrações aplicadas diretamente da tabela
    const appliedMigrations = await knexInstance(migrationsTable).select('*').orderBy('id', 'asc');
    console.log('Migrações aplicadas encontradas na tabela:', appliedMigrations.length);
    
    // Obter arquivos de migração disponíveis no diretório
    const migrationsDir = path.resolve(__dirname, dbType === DB_TYPES.CLIENTS ? './knex-clients' : './knex');
    let migrationFiles = [];
    try {
      migrationFiles = await fs.readdir(migrationsDir);
      console.log('Arquivos de migração encontrados no diretório:', migrationFiles.length);
    } catch (err) {
      console.error(`Erro ao ler diretório de migrações ${migrationsDir}:`, err);
    }
    
    // Determinar migrações pendentes (arquivos que não estão na tabela)
    const appliedNames = appliedMigrations.map(m => m.name);
    const pendingMigrations = migrationFiles.filter(file => 
      file.endsWith('.js') && !appliedNames.includes(file)
    );
    
    console.log('Migrações concluídas:', appliedMigrations.length);
    console.log('Migrações pendentes:', pendingMigrations.length);
    
    await knexInstance.destroy();
    
    return {
      success: true,
      message: `Status das migrações obtido com sucesso para banco ${dbType}`,
      details: {
        completed: appliedMigrations.map(m => m.name),
        pending: pendingMigrations,
        dbType
      }
    };
    
  } catch (error) {
    console.error(`Erro ao verificar status das migrações para banco ${dbType}:`, error);
    return {
      success: false,
      error: error.message,
      message: `Erro ao verificar status das migrações para banco ${dbType}`
    };
  }
};

// Exportar funções e constantes para uso fora do módulo
module.exports = {
  runMigrations,
  rollbackLastMigration,
  getStatus,
  DB_TYPES
};
