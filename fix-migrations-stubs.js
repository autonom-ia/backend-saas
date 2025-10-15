#!/usr/bin/env node
/**
 * Script para marcar stubs de migrações como executados
 * Uso: node fix-migrations-stubs.js
 */

const path = require('path');
const fs = require('fs');

// Forçar ambiente development
process.env.NODE_ENV = 'development';

// Carregar .env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const STUB_MIGRATIONS_TO_MARK = [
  '20250913000001_create_contact_table.js',
  '20251003000001_create_contact_table.js',
  '20251002130000_alter_kanban_items_add_priority.js',
  '20251003123500_alter_conversation_funnel_register_add_priority.js',
  '20251003124500_alter_conversation_funnel_step_add_kanban_code.js',
  '20251003130000_alter_kanban_items_widen_summary_priority.js',
  '20251003155500_alter_conversation_funnel_register_add_chatwoot_contact.js'
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

function log(emoji, message, data = null) {
  console.log(`${emoji} ${message}`);
  if (data) {
    console.log('   ', JSON.stringify(data, null, 2));
  }
}

function createStubFile(filename) {
  const migrationsDir = path.join(__dirname, 'shared', 'migrations', 'knex');
  const filepath = path.join(migrationsDir, filename);
  
  if (!fs.existsSync(filepath)) {
    log('❌', `Arquivo não existe: ${filename}`);
    return false;
  }
  
  // Verificar se já é stub
  const content = fs.readFileSync(filepath, 'utf8');
  const isStub = content.includes('Stub migration') || 
                 (content.includes('return Promise.resolve()') && content.length < 300);
  
  if (isStub) {
    log('✓ ', `${filename} - já é stub`);
    return true;
  }
  
  // Criar backup
  const backupPath = filepath + '.backup';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filepath, backupPath);
    log('💾', `Backup criado: ${filename}.backup`);
  }
  
  // Sobrescrever com stub
  fs.writeFileSync(filepath, STUB_TEMPLATE, 'utf8');
  log('✅', `${filename} - convertido em stub`);
  
  return true;
}

async function main() {
  console.log('\n='.repeat(60));
  console.log('🔧 FIX: Marcando Stubs de Migrações como Executados');
  console.log('='.repeat(60) + '\n');
  
  // Validar configuração
  log('📍', `POSTGRES_HOST: ${process.env.POSTGRES_HOST}`);
  log('📍', `POSTGRES_DATABASE: ${process.env.POSTGRES_DATABASE}`);
  
  if (process.env.POSTGRES_HOST?.includes('amazonaws.com')) {
    log('❌', 'ERRO: Configuração aponta para AWS! Use apenas em localhost.');
    process.exit(1);
  }
  
  // Criar stubs primeiro
  console.log('\n📝 Criando/verificando arquivos stub...\n');
  for (const filename of STUB_MIGRATIONS_TO_MARK) {
    createStubFile(filename);
  }
  
  // Carregar Knex
  console.log('\n🔌 Conectando ao banco...\n');
  const knexfile = require('./knexfile');
  const knex = require('knex')(knexfile.development);
  
  try {
    // Testar conexão
    await knex.raw('SELECT 1+1 as result');
    log('✅', 'Conexão estabelecida');
    
    // Verificar se tabela de migrações existe
    const hasTable = await knex.schema.hasTable('knex_migrations');
    if (!hasTable) {
      log('❌', 'Tabela knex_migrations não existe! Execute as migrações primeiro.');
      process.exit(1);
    }
    
    // Obter batch atual
    const lastBatch = await knex('knex_migrations')
      .max('batch as max_batch')
      .first();
    
    const currentBatch = (lastBatch?.max_batch || 0) + 1;
    log('📊', `Batch atual: ${currentBatch}`);
    
    // Marcar cada stub
    console.log('\n📋 Marcando stubs como executados...\n');
    
    let marked = 0;
    let skipped = 0;
    
    for (const filename of STUB_MIGRATIONS_TO_MARK) {
      const exists = await knex('knex_migrations')
        .where('name', filename)
        .first();
      
      if (exists) {
        log('⏭️ ', `${filename} - já marcado (batch ${exists.batch})`);
        skipped++;
      } else {
        await knex('knex_migrations').insert({
          name: filename,
          batch: currentBatch,
          migration_time: new Date()
        });
        log('✅', `${filename} - marcado no batch ${currentBatch}`);
        marked++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    log('🎉', 'CONCLUÍDO!');
    log('📊', `Marcados: ${marked} | Já existiam: ${skipped}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('💡 Agora execute: node setup-local-completo.js\n');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

main();