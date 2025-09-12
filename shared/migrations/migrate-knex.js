/**
 * Script para executar migrações do Knex via linha de comando
 * Uso:
 *   node migrate-knex.js                # Executar migrações pendentes no banco padrão
 *   node migrate-knex.js --clients      # Executar migrações pendentes no banco de clientes
 *   node migrate-knex.js --rollback     # Reverter última migração no banco padrão
 *   node migrate-knex.js --rollback --clients # Reverter última migração no banco de clientes
 *   node migrate-knex.js --status       # Verificar status das migrações no banco padrão
 *   node migrate-knex.js --status --clients # Verificar status das migrações no banco de clientes
 */

require('dotenv').config({ path: '../../.env' });
const { runMigrations, rollbackLastMigration, getStatus, DB_TYPES } = require('./migrate-knex-api');

// Analisar argumentos da linha de comando
const isRollback = process.argv.includes('--rollback');
const isStatus = process.argv.includes('--status');
const isClientsDb = process.argv.includes('--clients');

// Determinar qual banco de dados usar
const dbType = isClientsDb ? DB_TYPES.CLIENTS : DB_TYPES.DEFAULT;

async function main() {
  console.log('====================================');
  console.log('Ferramenta de Migração - autonom.ia');
  console.log('====================================');
  console.log(`Banco de dados alvo: ${dbType.toUpperCase()}`);
  
  try {
    let result;
    
    if (isStatus) {
      console.log('🔍 Verificando status das migrações...');
      result = await getStatus(dbType);
    } else if (isRollback) {
      console.log('⏮️ Executando rollback da última migração...');
      result = await rollbackLastMigration(dbType);
    } else {
      console.log('🚀 Executando migrações pendentes...');
      result = await runMigrations(dbType);
    }
    
    if (result.success) {
      console.log('✅ Operação concluída com sucesso!');
      console.log(result.message);
      
      if (result.details) {
        if (result.details.migrations && result.details.migrations.length > 0) {
          console.log('\nMigrações processadas:');
          result.details.migrations.forEach(migration => {
            console.log(` - ${migration}`);
          });
        }
        
        if (isStatus && result.details.completed) {
          console.log('\nMigrações já aplicadas:', result.details.completed.length);
          if (result.details.completed.length > 0) {
            result.details.completed.forEach(migration => {
              console.log(` - ${migration}`);
            });
          }
          
          console.log('\nMigrações pendentes:', result.details.pending.length);
          if (result.details.pending.length > 0) {
            result.details.pending.forEach(migration => {
              console.log(` - ${migration}`);
            });
          }
        }
      }
    } else {
      console.error('❌ Erro durante a operação:');
      console.error(result.message);
      if (result.error) {
        console.error(result.error);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro não tratado:');
    console.error(error);
    process.exit(1);
  }
}

main();
