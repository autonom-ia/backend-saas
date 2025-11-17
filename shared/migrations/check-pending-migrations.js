/**
 * Script para verificar migrações pendentes e retornar JSON
 * Usado pelo deploy.sh para decidir se deve perguntar sobre migrações
 * 
 * Retorna JSON com status das migrações e código de saída:
 * - Exit 0: há migrações pendentes
 * - Exit 1: não há migrações pendentes ou erro
 */

const path = require('path');
const fs = require('fs');

// Carregar .env apenas se as variáveis não estiverem já definidas (desenvolvimento local)
if (!process.env.POSTGRES_HOST && !process.env.DB_HOST) {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

const { getStatus, DB_TYPES } = require('./migrate-knex-api');

async function checkPendingMigrations() {
  const results = {
    default: { hasPending: false, pendingCount: 0, error: null },
    clients: { hasPending: false, pendingCount: 0, error: null }
  };

  // Verificar banco principal (suprimir logs do getStatus)
  try {
    // Redirecionar console.log temporariamente para não poluir o output
    const originalLog = console.log;
    console.log = () => {}; // Suprimir logs
    
    const defaultStatus = await getStatus(DB_TYPES.DEFAULT);
    
    // Restaurar console.log
    console.log = originalLog;
    
    if (defaultStatus.success && defaultStatus.details) {
      results.default.pendingCount = defaultStatus.details.pending ? defaultStatus.details.pending.length : 0;
      results.default.hasPending = results.default.pendingCount > 0;
    } else {
      results.default.error = defaultStatus.message || 'Erro ao verificar status';
    }
  } catch (error) {
    results.default.error = error.message;
  }

  // Verificar banco clients (suprimir logs do getStatus)
  try {
    const originalLog = console.log;
    console.log = () => {}; // Suprimir logs
    
    const clientsStatus = await getStatus(DB_TYPES.CLIENTS);
    
    // Restaurar console.log
    console.log = originalLog;
    
    if (clientsStatus.success && clientsStatus.details) {
      results.clients.pendingCount = clientsStatus.details.pending ? clientsStatus.details.pending.length : 0;
      results.clients.hasPending = results.clients.pendingCount > 0;
    } else {
      results.clients.error = clientsStatus.message || 'Erro ao verificar status';
    }
  } catch (error) {
    results.clients.error = error.message;
  }

  // Retornar JSON (apenas JSON, sem outros logs)
  console.log(JSON.stringify(results));
  
  // Retornar código de saída baseado em se há migrações pendentes
  const hasAnyPending = results.default.hasPending || results.clients.hasPending;
  process.exit(hasAnyPending ? 0 : 1);
}

checkPendingMigrations();

