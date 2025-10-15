#!/usr/bin/env node
/**
 * Setup Completo do Ambiente Local - Autonomia Backend
 * 
 * Este script faz tudo:
 * - Cria stubs das migrações faltantes
 * - Roda migrações via Knex direto (bypass dos scripts)
 * - Insere dados iniciais (perfil ADMIN, usuário, produto)
 * - Cria arquivo event.json para testes
 * 
 * Uso: node setup-local-completo.js
 */

// ============================================
// CONFIGURAÇÃO - AJUSTE AQUI!
// ============================================
const USER_EMAIL = 'adfelipevs@gmail.com'; // ⚠️ ALTERE ESTE EMAIL!
const USER_NAME = 'Admin Local';
// ============================================

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

// FORÇAR ambiente development ANTES de qualquer coisa
process.env.NODE_ENV = 'development';

// Carregar .env
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Constantes
const ADMIN_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';
const PRODUCT_ID = '83678adb-39c4-444c-bfb3-d8955aab5d47';

// Migrações que devem ser transformadas em stubs (já aplicadas ou duplicadas)
const MISSING_MIGRATIONS = [
  // Contact table migrations - manter apenas 20250923084100 como funcional
  '20250913000001_create_contact_table.js',  // ← Stub (duplicata mais antiga)
  '20251003000001_create_contact_table.js',  // ← Stub (duplicata mais recente)
  
  // Outras migrações faltantes ou problemáticas
  '20251002130000_alter_kanban_items_add_priority.js',
  '20251003123500_alter_conversation_funnel_register_add_priority.js',
  '20251003124500_alter_conversation_funnel_step_add_kanban_code.js',
  '20251003130000_alter_kanban_items_widen_summary_priority.js',
  '20251003155500_alter_conversation_funnel_register_add_chatwoot_contact.js'
];

// Migrações que devem ser restauradas (se tiverem backup)
const MIGRATIONS_TO_RESTORE = [
  '20250923084100_create_contact_table.js'  // Restaurar do backup para criar a tabela
];

const STUB_TEMPLATE = `/**
 * Stub migration - Already applied in production
 * Created to resolve migration history conflict
 */
exports.up = function(knex) {
  return Promise.resolve();
};

exports.down = function(knex) {
  return Promise.resolve();
};
`;

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function log(emoji, message, data = null) {
  console.log(`${emoji} ${message}`);
  if (data) {
    console.log('   ', data);
  }
}

function validateEmail() {
  if (USER_EMAIL === 'seu.email@dominio.com') {
    log('❌', 'ERRO: Você precisa alterar o USER_EMAIL no início do arquivo!');
    log('💡', 'Edite a linha 15 e coloque seu email real.');
    process.exit(1);
  }
}

function validateConfig() {
  logSection('🔍 VALIDANDO CONFIGURAÇÃO');
  
  log('📍', `NODE_ENV: ${process.env.NODE_ENV}`);
  log('📍', `POSTGRES_HOST: ${process.env.POSTGRES_HOST}`);
  log('📍', `POSTGRES_DATABASE: ${process.env.POSTGRES_DATABASE}`);
  log('📍', `POSTGRES_USER: ${process.env.POSTGRES_USER}`);
  
  // Validação de segurança
  if (!process.env.POSTGRES_HOST) {
    log('❌', 'ERRO: POSTGRES_HOST não definido no .env');
    process.exit(1);
  }
  
  if (process.env.POSTGRES_HOST.includes('amazonaws.com')) {
    log('❌', 'ERRO: Configuração está apontando para AWS!');
    log('💡', 'Verifique o arquivo .env e certifique-se que POSTGRES_HOST=localhost');
    process.exit(1);
  }
  
  log('✅', 'Configuração válida!');
}

function restoreMigrations() {
  logSection('🔄 RESTAURANDO MIGRAÇÕES NECESSÁRIAS');
  
  const migrationsDir = path.join(__dirname, 'shared', 'migrations', 'knex');
  let restored = 0;
  
  MIGRATIONS_TO_RESTORE.forEach(filename => {
    const filepath = path.join(migrationsDir, filename);
    const backupPath = filepath + '.backup';
    
    if (fs.existsSync(backupPath)) {
      // Restaurar do backup
      fs.copyFileSync(backupPath, filepath);
      log('✅', `${filename} - restaurado do backup`);
      restored++;
    } else if (fs.existsSync(filepath)) {
      // Verificar se já está restaurado (não é stub)
      const content = fs.readFileSync(filepath, 'utf8');
      const isStub = content.includes('Stub migration') || 
                     (content.includes('return Promise.resolve()') && content.length < 300);
      
      if (isStub) {
        log('⚠️ ', `${filename} - backup não encontrado, migração será stub`);
      } else {
        log('✓ ', `${filename} - já está funcional`);
      }
    } else {
      log('❌', `${filename} - arquivo não encontrado`);
    }
  });
  
  if (restored > 0) {
    log('🎉', `${restored} migração(ões) restaurada(s)`);
  } else {
    log('ℹ️ ', 'Nenhuma migração precisou ser restaurada');
  }
}

function createStubMigrations() {
  logSection('📝 CRIANDO/SOBRESCREVENDO STUBS');
  
  const migrationsDir = path.join(__dirname, 'shared', 'migrations', 'knex');
  
  if (!fs.existsSync(migrationsDir)) {
    log('❌', `Diretório não encontrado: ${migrationsDir}`);
    process.exit(1);
  }
  
  let created = 0;
  let overwritten = 0;
  
  MISSING_MIGRATIONS.forEach(filename => {
    const filepath = path.join(migrationsDir, filename);
    
    if (fs.existsSync(filepath)) {
      // Verificar se já é um stub
      const content = fs.readFileSync(filepath, 'utf8');
      const isAlreadyStub = content.includes('Stub migration') || 
                            (content.includes('return Promise.resolve()') && content.length < 300);
      
      if (isAlreadyStub) {
        log('✓ ', `${filename} - já é stub`);
      } else {
        // Fazer backup antes de sobrescrever
        const backupPath = filepath + '.backup';
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(filepath, backupPath);
        }
        
        // Sobrescrever com stub
        fs.writeFileSync(filepath, STUB_TEMPLATE, 'utf8');
        log('🔄', `${filename} - sobrescrito com stub (backup criado)`);
        overwritten++;
      }
    } else {
      fs.writeFileSync(filepath, STUB_TEMPLATE, 'utf8');
      log('✅', `${filename} - criado`);
      created++;
    }
  });
  
  log('📊', `Resumo: ${created} criados, ${overwritten} sobrescritos`);
  
  if (created > 0 || overwritten > 0) {
    log('🎉', 'Stubs processados com sucesso!');
  }
}

async function markStubsAsExecuted(knex) {
  log('⏳', 'Marcando stubs como executados...');
  
  // Obter o batch atual
  const lastBatch = await knex('knex_migrations')
    .max('batch as max_batch')
    .first();
  
  const nextBatch = (lastBatch?.max_batch || 0) + 1;
  
  // Marcar stubs que ainda não foram registrados
  for (const stubFile of MISSING_MIGRATIONS) {
    const exists = await knex('knex_migrations')
      .where('name', stubFile)
      .first();
    
    if (!exists) {
      await knex('knex_migrations').insert({
        name: stubFile,
        batch: nextBatch,
        migration_time: new Date()
      });
      log('  ✅', `${stubFile} marcado como executado`);
    }
  }
}

async function runMigrations() {
  logSection('🚀 EXECUTANDO MIGRAÇÕES');
  
  log('⏳', 'Carregando configuração do Knex...');
  
  // Carregar knexfile
  const knexfile = require('./knexfile');
  const config = knexfile.development;
  
  log('📋', 'Configuração do banco:', {
    host: config.connection.host,
    database: config.connection.database,
    user: config.connection.user
  });
  
  // Inicializar Knex
  const knex = require('knex')(config);
  
  try {
    // Testar conexão
    log('🔌', 'Testando conexão...');
    await knex.raw('SELECT 1+1 as result');
    log('✅', 'Conexão estabelecida!');
    
    // Marcar stubs como executados ANTES de rodar migrações
    await markStubsAsExecuted(knex);
    
    // Executar migrações
    log('⏳', 'Executando migrações pendentes...');
    const [batchNo, migrations] = await knex.migrate.latest();
    
    if (migrations.length === 0) {
      log('ℹ️ ', 'Nenhuma migração pendente');
    } else {
      log('✅', `${migrations.length} migrações executadas no batch ${batchNo}`);
      migrations.forEach(m => log('  📄', m));
    }
    
    return true;
  } catch (error) {
    log('❌', 'Erro ao executar migrações:', error.message);
    
    // Se o erro for sobre arquivos faltando, mostrar quais
    if (error.message.includes('missing')) {
      log('💡', 'Alguns arquivos de migração ainda estão faltando.');
      log('💡', 'Verifique se os stubs foram criados corretamente.');
    }
    
    throw error;
  } finally {
    await knex.destroy();
  }
}

async function insertSeedData(client) {
  logSection('🌱 INSERINDO DADOS INICIAIS');
  
  try {
    // 1. Perfil ADMIN
    log('📝', 'Criando perfil ADMIN...');
    await client.query(`
      INSERT INTO access_profiles (id, name, description, admin)
      VALUES ($1, 'Admin', 'Perfil administrador local', true)
      ON CONFLICT (id) DO NOTHING
    `, [ADMIN_PROFILE_ID]);
    log('✅', 'Perfil ADMIN criado');
    
    // 2. Usuário
    log('📝', `Criando usuário (${USER_EMAIL})...`);
    const userResult = await client.query(`
      INSERT INTO users (email, phone, name)
      VALUES ($1, NULL, $2)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, email, name
    `, [USER_EMAIL, USER_NAME]);
    
    const userId = userResult.rows[0].id;
    log('✅', 'Usuário criado:', {
      id: userId,
      email: userResult.rows[0].email,
      name: userResult.rows[0].name
    });
    
    // 3. Vincular ao perfil ADMIN
    log('📝', 'Vinculando usuário ao perfil ADMIN...');
    await client.query(`
      INSERT INTO user_access_profiles (user_id, access_profile_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, access_profile_id) DO NOTHING
    `, [userId, ADMIN_PROFILE_ID]);
    log('✅', 'Vínculo criado');
    
    // 4. Produto
    log('📝', 'Inserindo produto de exemplo...');
    await client.query(`
      INSERT INTO product (id, name, description)
      VALUES ($1, 'Agente - Produtos em Geral', 'Agente para venda e suporte N1 pós venda para empresas')
      ON CONFLICT (id) DO NOTHING
    `, [PRODUCT_ID]);
    log('✅', 'Produto inserido');
    
    return userId;
  } catch (error) {
    log('❌', 'Erro ao inserir dados:', error.message);
    throw error;
  }
}

async function verifyData(client) {
  logSection('🔍 VERIFICANDO DADOS');
  
  // Verificar usuário e perfil
  const userCheck = await client.query(`
    SELECT 
      u.id,
      u.email,
      u.name,
      ap.name as profile_name,
      ap.admin
    FROM users u
    INNER JOIN user_access_profiles uap ON u.id = uap.user_id
    INNER JOIN access_profiles ap ON uap.access_profile_id = ap.id
    WHERE u.email = $1
  `, [USER_EMAIL]);
  
  if (userCheck.rows.length > 0) {
    log('✅', 'Usuário verificado:', userCheck.rows[0]);
  } else {
    log('⚠️ ', 'Usuário não encontrado!');
  }
  
  // Contar produtos
  const productCount = await client.query('SELECT COUNT(*) FROM product');
  log('📦', `Total de produtos: ${productCount.rows[0].count}`);
}

function createEventJson() {
  logSection('📄 CRIANDO ARQUIVO DE TESTE');
  
  const eventJson = {
    httpMethod: "GET",
    headers: {
      origin: "http://localhost:3000"
    },
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            email: USER_EMAIL
          }
        }
      }
    }
  };
  
  const eventPath = path.join(__dirname, 'api', 'saas', 'event.json');
  fs.writeFileSync(eventPath, JSON.stringify(eventJson, null, 2), 'utf8');
  
  log('✅', `Arquivo criado: ${eventPath}`);
}

function showNextSteps() {
  logSection('🎉 SETUP CONCLUÍDO COM SUCESSO!');
  
  console.log('\n📝 PRÓXIMOS PASSOS:\n');
  console.log('1️⃣  Testar a API localmente:');
  console.log('   cd api/saas');
  console.log('   npx serverless invoke local -f listProducts --path event.json\n');
  
  console.log('2️⃣  Ou subir o servidor HTTP local:');
  console.log('   cd api/saas');
  console.log('   npx serverless offline --stage dev\n');
  
  console.log(`📧 Email para testes: ${USER_EMAIL}\n`);
  console.log('💡 Dica: Se precisar recriar os dados, rode este script novamente.\n');
}

// ============================================
// EXECUÇÃO PRINCIPAL
// ============================================

async function main() {
  console.log('\n');
  console.log('█████████████████████████████████████████████████████████████');
  console.log('█                                                           █');
  console.log('█         🚀 SETUP COMPLETO - AUTONOMIA BACKEND 🚀          █');
  console.log('█                                                           █');
  console.log('█████████████████████████████████████████████████████████████');
  console.log('\n');
  
  // Validações iniciais
  validateEmail();
  validateConfig();
  
  // Criar cliente PostgreSQL para extensões
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  
  let seedClient = null;
  
  try {
    // Conectar ao banco
    logSection('🔌 CONECTANDO AO POSTGRESQL');
    await client.connect();
    
    // Habilitar extensões
    log('⏳', 'Habilitando extensão pgcrypto...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    log('✅', 'Extensão habilitada');
    
    // Desconectar antes das migrações (Knex usa seu próprio pool)
    await client.end();
    
    // Restaurar migrações necessárias ANTES de criar stubs
    restoreMigrations();
    
    // Criar stubs
    createStubMigrations();
    
    // Executar migrações
    await runMigrations();
    
    // Criar NOVO cliente para seed (não reusar o anterior)
    seedClient = new Client({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    
    await seedClient.connect();
    
    // Inserir dados
    await insertSeedData(seedClient);
    
    // Verificar
    await verifyData(seedClient);
    
    // Criar arquivo de teste
    createEventJson();
    
    // Mostrar próximos passos
    showNextSteps();
    
  } catch (error) {
    logSection('❌ ERRO DURANTE O SETUP');
    console.error(error);
    process.exit(1);
  } finally {
    // Fechar seedClient se foi criado
    if (seedClient) {
      try {
        await seedClient.end();
      } catch (e) {
        // Ignorar erros ao fechar
      }
    }
  }
}

// Executar
main();