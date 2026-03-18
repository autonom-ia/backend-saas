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

const getMigrationsDirectory = (dbType = DB_TYPES.DEFAULT) => path.resolve(
  __dirname,
  dbType === DB_TYPES.CLIENTS ? './knex-clients' : './knex'
);

const getMigrationsTableName = (dbType = DB_TYPES.DEFAULT) => (
  dbType === DB_TYPES.CLIENTS ? 'knex_migrations_clients' : 'knex_migrations'
);

const listMigrationFiles = async (migrationsDir) => {
  try {
    const files = await fs.readdir(migrationsDir);
    return files.filter(file => file.endsWith('.js')).sort();
  } catch (error) {
    console.error(`Erro ao ler diretório de migrações ${migrationsDir}:`, error);
    return [];
  }
};

const getMigrationInventory = async (knexInstance, dbType = DB_TYPES.DEFAULT) => {
  const migrationsTable = getMigrationsTableName(dbType);
  const migrationsDir = getMigrationsDirectory(dbType);
  const hasTable = await knexInstance.schema.hasTable(migrationsTable);
  const migrationFiles = await listMigrationFiles(migrationsDir);

  if (!hasTable) {
    return {
      hasTable,
      migrationsTable,
      migrationsDir,
      migrationFiles,
      appliedMigrations: [],
      appliedNames: [],
      pendingMigrations: migrationFiles,
      missingMigrations: [],
    };
  }

  const appliedMigrations = await knexInstance(migrationsTable).select('*').orderBy('id', 'asc');
  const appliedNames = appliedMigrations.map(migration => migration.name);
  const pendingMigrations = migrationFiles.filter(file => !appliedNames.includes(file));
  const missingMigrations = appliedNames.filter(name => !migrationFiles.includes(name));

  return {
    hasTable,
    migrationsTable,
    migrationsDir,
    migrationFiles,
    appliedMigrations,
    appliedNames,
    pendingMigrations,
    missingMigrations,
  };
};

const shouldUseControlledMode = () => process.argv.includes('--allow-missing');

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
    
    // Debug: verificar variáveis disponíveis
    console.log('Variáveis de ambiente disponíveis:', {
      hasDB_HOST: !!process.env.DB_HOST,
      hasDB_PASSWORD: !!process.env.DB_PASSWORD,
      hasPOSTGRES_HOST: !!process.env.POSTGRES_HOST,
      hasPOSTGRES_PASSWORD: !!process.env.POSTGRES_PASSWORD
    });
    
    // Modificar a configuração com base no tipo de banco de dados
    if (dbType === DB_TYPES.CLIENTS) {
      // Banco clients: usar variáveis específicas ou mapear de variáveis gerais
      // Durante deploy, o deploy.sh injeta CLIENTS_DB_* do SSM (tenta staging/clients primeiro, depois clients)
      // Localmente, pode usar CLIENTS_POSTGRES_* do .env
      // Prioridade: CLIENTS_DB_* (SSM) > CLIENTS_POSTGRES_* (.env) > POSTGRES_* (.env) > config padrão
      config.connection.host = process.env.CLIENTS_DB_HOST || process.env.CLIENTS_POSTGRES_HOST || process.env.POSTGRES_HOST || config.connection.host;
      config.connection.port = process.env.CLIENTS_DB_PORT || process.env.CLIENTS_POSTGRES_PORT || process.env.POSTGRES_PORT || config.connection.port;
      config.connection.database = process.env.CLIENTS_DB_NAME || process.env.CLIENTS_POSTGRES_DATABASE || 'autonomia_clients';
      config.connection.user = process.env.CLIENTS_DB_USER || process.env.CLIENTS_POSTGRES_USER || 'autonomia_clients_admin';
      config.connection.password = process.env.CLIENTS_DB_PASSWORD || process.env.CLIENTS_POSTGRES_PASSWORD || config.connection.password;
      
      // SSL
      const sslEnabled = process.env.CLIENTS_DB_SSL_ENABLED || process.env.POSTGRES_SSL;
      config.connection.ssl = sslEnabled === 'true' ? { rejectUnauthorized: false } : false;
      
      // Alterar o diretório de migrações e a tabela de controle
      config.migrations.directory = './shared/migrations/knex-clients';
      config.migrations.tableName = 'knex_migrations_clients';
    } else {
      // Banco principal: mapear de DB_* (usado pelo serverless) para POSTGRES_* (usado pelo knexfile)
      // Durante deploy, o deploy.sh injeta DB_* do SSM
      // Localmente, usa POSTGRES_* do .env
      if (process.env.DB_HOST) {
        // Mapear variáveis DB_* (do SSM) para configuração do Knex
        config.connection.host = process.env.DB_HOST;
        config.connection.port = process.env.DB_PORT || config.connection.port || 5432;
        config.connection.database = process.env.DB_NAME || config.connection.database || 'autonomia_db';
        config.connection.user = process.env.DB_USER;
        config.connection.password = process.env.DB_PASSWORD;
        const sslEnabled = process.env.DB_SSL_ENABLED;
        config.connection.ssl = sslEnabled === 'true' ? { rejectUnauthorized: false } : false;
        
        console.log('Configuração mapeada de DB_* (SSM):', {
          host: config.connection.host,
          database: config.connection.database,
          user: config.connection.user,
          hasPassword: !!config.connection.password,
          ssl: config.connection.ssl
        });
      } else if (process.env.POSTGRES_HOST) {
        // Se tiver POSTGRES_* (do .env), usar diretamente
        // O knexfile já carrega essas variáveis, mas garantimos que estão corretas
        config.connection.host = process.env.POSTGRES_HOST;
        config.connection.port = process.env.POSTGRES_PORT || config.connection.port;
        config.connection.database = process.env.POSTGRES_DATABASE || config.connection.database;
        config.connection.user = process.env.POSTGRES_USER;
        config.connection.password = process.env.POSTGRES_PASSWORD;
        const sslEnabled = process.env.POSTGRES_SSL;
        config.connection.ssl = sslEnabled === 'true' ? { rejectUnauthorized: false } : false;
      }
      // Se não tiver nenhum, o knexfile usa valores padrão ou do .env já carregado
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
      const msg = migrationError && migrationError.message ? migrationError.message : String(migrationError);

      if (msg.includes('The migration directory is corrupt, the following files are missing')) {
        const inventory = await getMigrationInventory(knexInstance, dbType);
        const allowMissing = shouldUseControlledMode();

        console.warn('[migrate-knex-api] Aviso: diretório de migrações considerado corrompido pelo Knex (arquivos ausentes).', {
          dbType,
          missingMigrations: inventory.missingMigrations,
          pendingMigrations: inventory.pendingMigrations,
        });

        if (!allowMissing) {
          await knexInstance.destroy();
          return {
            success: false,
            error: msg,
            message: `Diretório de migrações inconsistente para banco ${dbType}. Reexecute com --allow-missing para aplicar apenas as migrações novas após reconciliar os arquivos ausentes.`,
            details: {
              batchNo: null,
              migrations: [],
              dbType,
              pending: inventory.pendingMigrations,
              missing: inventory.missingMigrations,
            }
          };
        }

        const controlledConfig = {
          ...config,
          migrations: {
            ...config.migrations,
            disableMigrationsListValidation: true,
          },
        };

        await knexInstance.destroy();
        const controlledKnexInstance = knex(controlledConfig);

        try {
          [batchNo, log] = await controlledKnexInstance.migrate.latest();
        } catch (controlledError) {
          const controlledMessage = controlledError?.message || String(controlledError);
          console.error('[migrate-knex-api] Erro ao executar migrações em modo controlado:', controlledMessage);
          await controlledKnexInstance.destroy();
          return {
            success: false,
            error: controlledMessage,
            message: `Erro ao executar migrações em modo controlado para banco ${dbType}`,
            details: {
              batchNo: null,
              migrations: [],
              dbType,
              pending: inventory.pendingMigrations,
              missing: inventory.missingMigrations,
            }
          };
        }

        await controlledKnexInstance.destroy();

        return {
          success: true,
          message: `${log.length} migrações aplicadas com sucesso no banco ${dbType} em modo controlado`,
          details: {
            batchNo,
            migrations: log,
            dbType,
            pending: inventory.pendingMigrations,
            missing: inventory.missingMigrations,
            controlledMode: true,
          }
        };
      }

      if (msg.includes('already exists')) {
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
        console.error('Erro ao executar migrações:', msg);
        await knexInstance.destroy();
        return {
          success: false,
          error: msg,
          message: `Erro ao executar migrações para banco ${dbType}`
        };
      }
    }
    
    if (!log || log.length === 0) {
      console.log('Nenhuma migração pendente encontrada.');
      const inventory = await getMigrationInventory(knexInstance, dbType);
      await knexInstance.destroy();
      return {
        success: true,
        message: 'Nenhuma migração pendente',
        details: {
          batchNo,
          migrations: log || [],
          dbType,
          pending: inventory.pendingMigrations,
          missing: inventory.missingMigrations,
        }
      };
    }
    
    console.log(`Executadas ${log.length} migrações no batch ${batchNo}`);
    console.log('Migrações aplicadas:', log);
    
    // Fechar a conexão após concluir
    await knexInstance.destroy();
    
    return {
      success: true,
      message: `${log.length} migrações aplicadas com sucesso no banco ${dbType}`,
      details: { batchNo, migrations: log, dbType, controlledMode: false }
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
    
    const migrationsTable = getMigrationsTableName(dbType);
    
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
      const migrationsDir = getMigrationsDirectory(dbType);
      const pendingMigrations = await listMigrationFiles(migrationsDir);
      console.log(`Encontrados ${pendingMigrations.length} arquivos de migração no diretório ${migrationsDir}`);
      
      await knexInstance.destroy();
      return {
        success: true,
        message: 'Nenhuma migração aplicada ainda',
        details: {
          completed: [],
          pending: pendingMigrations,
          missing: [],
          dbType
        }
      };
    }
    
    const inventory = await getMigrationInventory(knexInstance, dbType);
    console.log('Migrações aplicadas encontradas na tabela:', inventory.appliedMigrations.length);
    console.log('Arquivos de migração encontrados no diretório:', inventory.migrationFiles.length);
    
    console.log('Migrações concluídas:', inventory.appliedMigrations.length);
    console.log('Migrações pendentes:', inventory.pendingMigrations.length);
    console.log('Migrações ausentes no diretório:', inventory.missingMigrations.length);
    
    await knexInstance.destroy();
    
    return {
      success: true,
      message: `Status das migrações obtido com sucesso para banco ${dbType}`,
      details: {
        completed: inventory.appliedNames,
        pending: inventory.pendingMigrations,
        missing: inventory.missingMigrations,
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
