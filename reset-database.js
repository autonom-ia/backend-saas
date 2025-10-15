#!/usr/bin/env node
/**
 * Reseta o banco de dados PostgreSQL completamente
 * ATENÇÃO: Apaga TODOS os dados e recria o schema do zero
 * 
 * Uso: node reset-database.js
 */

const path = require('path');
const { Client } = require('pg');

process.env.NODE_ENV = 'development';
require('dotenv').config({ path: path.join(__dirname, '.env') });

function log(emoji, message, data = null) {
  console.log(`${emoji} ${message}`);
  if (data) console.log('   ', data);
}

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

async function main() {
  console.log('\n');
  console.log('⚠️ ⚠️ ⚠️  ATENÇÃO ⚠️ ⚠️ ⚠️ \n');
  console.log('Este script vai APAGAR TODOS OS DADOS do banco local!');
  console.log('Banco: ' + process.env.POSTGRES_DATABASE);
  console.log('Host: ' + process.env.POSTGRES_HOST);
  console.log('\n');
  
  // Validação de segurança
  if (process.env.POSTGRES_HOST?.includes('amazonaws.com') || 
      process.env.POSTGRES_HOST?.includes('rds')) {
    console.error('❌ ERRO: Este script não pode ser executado em produção!');
    console.error('Host detectado: ' + process.env.POSTGRES_HOST);
    process.exit(1);
  }
  
  if (process.env.POSTGRES_HOST !== 'localhost' && 
      process.env.POSTGRES_HOST !== '127.0.0.1') {
    console.error('❌ ERRO: Este script só pode ser executado em localhost!');
    console.error('Host detectado: ' + process.env.POSTGRES_HOST);
    process.exit(1);
  }
  
  logSection('🗑️  RESETANDO BANCO DE DADOS LOCAL');
  
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    log('🔌', 'Conectando ao PostgreSQL...');
    await client.connect();
    log('✅', 'Conectado!');
    
    // Dropar schema public
    log('🗑️ ', 'Dropando schema public...');
    await client.query('DROP SCHEMA public CASCADE');
    log('✅', 'Schema dropado!');
    
    // Recriar schema public
    log('🔨', 'Recriando schema public...');
    await client.query('CREATE SCHEMA public');
    log('✅', 'Schema recriado!');
    
    // Garantir permissões
    log('🔐', 'Configurando permissões...');
    await client.query(`GRANT ALL ON SCHEMA public TO ${process.env.POSTGRES_USER}`);
    await client.query('GRANT ALL ON SCHEMA public TO public');
    log('✅', 'Permissões configuradas!');
    
    // Habilitar extensão pgcrypto
    log('🔧', 'Habilitando extensão pgcrypto...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    log('✅', 'Extensão habilitada!');
    
    logSection('🎉 BANCO RESETADO COM SUCESSO!');
    
    console.log('\n📝 Próximos passos:\n');
    console.log('1. Execute o setup completo:');
    console.log('   node setup-local-completo.js\n');
    
  } catch (error) {
    logSection('❌ ERRO');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();