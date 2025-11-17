/**
 * Script para listar todas as tabelas de um banco de dados
 * 
 * Uso:
 *   node list-tables.js                # Lista tabelas do banco principal
 *   node list-tables.js --clients      # Lista tabelas do banco clients
 */

const path = require('path');
const fs = require('fs');

// Carregar .env se necessário
if (!process.env.POSTGRES_HOST && !process.env.DB_HOST) {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

const knex = require('knex');
const { loadKnexConfig, DB_TYPES } = require('./migrate-knex-api');

async function listTables() {
  const isClientsDb = process.argv.includes('--clients');
  const dbType = isClientsDb ? DB_TYPES.CLIENTS : DB_TYPES.DEFAULT;
  const dbName = isClientsDb ? 'autonomia_clients' : 'autonomia_db';
  
  console.log(`📊 Listando tabelas do banco: ${dbName}\n`);
  
  try {
    const config = loadKnexConfig(dbType);
    const db = knex(config);
    
    // Listar tabelas
    const result = await db.raw(`
      SELECT 
        t.table_name,
        t.table_type,
        COUNT(c.column_name) as num_columns
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
      WHERE t.table_schema = 'public'
      GROUP BY t.table_name, t.table_type
      ORDER BY t.table_name
    `);
    
    if (result.rows.length === 0) {
      console.log('Nenhuma tabela encontrada.');
    } else {
      console.log('Tabelas encontradas:\n');
      result.rows.forEach(row => {
        console.log(`  📋 ${row.table_name}`);
        console.log(`     Tipo: ${row.table_type}`);
        console.log(`     Colunas: ${row.num_columns}`);
        console.log('');
      });
      console.log(`Total: ${result.rows.length} tabela(s)\n`);
    }
    
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao listar tabelas:', error.message);
    process.exit(1);
  }
}

listTables();

