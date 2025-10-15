#!/usr/bin/env node
/**
 * Gerenciador de Desenvolvimento - Backend SaaS Autonomia
 * 
 * Script para facilitar tarefas comuns de desenvolvimento:
 * - Iniciar/parar containers Docker
 * - Executar migrações
 * - Testar API
 * - Reset completo do ambiente
 * 
 * Uso: node dev-manager.js [comando]
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, emoji, message) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
}

function execCommand(command, cwd = __dirname) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function startDocker() {
  log('blue', '🐳', 'Iniciando container PostgreSQL...');
  
  try {
    // Verificar se container existe
    await execCommand('docker ps -a --filter name=autonomia-postgres --format "{{.Names}}"');
    
    // Tentar iniciar container existente
    try {
      await execCommand('docker start autonomia-postgres');
      log('green', '✅', 'Container PostgreSQL iniciado com sucesso!');
    } catch (e) {
      // Se não existe, criar novo
      log('yellow', '📦', 'Criando novo container PostgreSQL...');
      await execCommand(`docker run -d \
        --name autonomia-postgres \
        -e POSTGRES_DB=autonomia_db \
        -e POSTGRES_USER=autonomia_admin \
        -e POSTGRES_PASSWORD=autonomia123 \
        -p 5432:5432 \
        postgres:14`);
      log('green', '✅', 'Container PostgreSQL criado e iniciado!');
    }
    
    // Aguardar banco ficar pronto
    log('yellow', '⏳', 'Aguardando banco ficar pronto...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
  } catch (error) {
    log('red', '❌', `Erro ao iniciar Docker: ${error.error?.message || error.stdout || error.stderr}`);
    throw error;
  }
}

async function stopDocker() {
  log('yellow', '🛑', 'Parando container PostgreSQL...');
  
  try {
    await execCommand('docker stop autonomia-postgres');
    log('green', '✅', 'Container PostgreSQL parado!');
  } catch (error) {
    log('red', '❌', `Erro ao parar Docker: ${error.error?.message || error.stdout || error.stderr}`);
  }
}

async function setupDatabase() {
  log('blue', '🗄️', 'Configurando banco de dados...');
  
  try {
    const result = await execCommand('node setup-local-completo.js');
    log('green', '✅', 'Banco configurado com sucesso!');
    console.log(result.stdout);
  } catch (error) {
    log('red', '❌', `Erro ao configurar banco: ${error.error?.message || error.stderr}`);
    throw error;
  }
}

async function startAPI() {
  log('blue', '🚀', 'Iniciando servidores da API...');
  
  const saasPath = path.join(__dirname, 'api', 'saas');
  const authPath = path.join(__dirname, 'api', 'auth');
  
  // Verificar dependências SaaS
  if (!fs.existsSync(path.join(saasPath, 'node_modules', 'serverless-offline'))) {
    log('yellow', '📦', 'Instalando dependências SaaS...');
    await execCommand('npm install', saasPath);
  }
  
  // Verificar dependências Auth
  if (!fs.existsSync(path.join(authPath, 'node_modules', 'serverless-offline'))) {
    log('yellow', '📦', 'Instalando dependências Auth...');
    await execCommand('npm install', authPath);
  }
  
  log('green', '✅', 'API SaaS: http://localhost:3001');
  log('green', '✅', 'API Auth: http://localhost:3003');
  log('cyan', '💡', 'Para parar: Ctrl+C nos terminais');
  log('cyan', '💡', 'Para testar: node dev-manager.js test');
  
  // Iniciar servidor SaaS
  const saasProcess = spawn('npx', ['serverless', 'offline', 'start', '--config', 'serverless.local.yml'], {
    cwd: saasPath,
    stdio: 'inherit'
  });
  
  // Aguardar um pouco antes de iniciar o Auth
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Iniciar servidor Auth em novo terminal/processo
  const authProcess = spawn('npx', ['serverless', 'offline', 'start', '--config', 'serverless.local.yml'], {
    cwd: authPath,
    stdio: 'inherit'
  });
  
  return { saasProcess, authProcess };
}

async function testAPI() {
  log('blue', '🧪', 'Testando API...');
  
  const testPath = path.join(__dirname, 'api', 'saas', 'test-api.js');
  
  try {
    const result = await execCommand(`node test-api.js`, path.dirname(testPath));
    console.log(result.stdout);
    log('green', '✅', 'Teste concluído!');
  } catch (error) {
    log('red', '❌', `Erro no teste: ${error.error?.message || error.stderr}`);
    console.log(error.stdout);
  }
}

async function testAllEndpoints() {
  log('blue', '🧪', 'Testando todos os endpoints...');
  
  const testPath = path.join(__dirname, 'api', 'saas', 'scripts', 'test-all-endpoints.js');
  
  try {
    const result = await execCommand(`node scripts/test-all-endpoints.js`, path.join(__dirname, 'api', 'saas'));
    console.log(result.stdout);
    log('green', '✅', 'Testes concluídos!');
  } catch (error) {
    log('red', '❌', `Erro nos testes: ${error.error?.message || error.stderr}`);
    console.log(error.stdout);
  }
}

async function resetEnvironment() {
  log('yellow', '🔄', 'Fazendo reset completo do ambiente...');
  
  try {
    // Parar containers
    await stopDocker();
    
    // Remover container
    try {
      await execCommand('docker rm autonomia-postgres');
    } catch (e) {
      // Ignorar se não existir
    }
    
    // Iniciar novamente
    await startDocker();
    
    // Reconfigurar banco
    await setupDatabase();
    
    log('green', '✅', 'Reset completo realizado com sucesso!');
    
  } catch (error) {
    log('red', '❌', `Erro no reset: ${error.message}`);
  }
}

function showHelp() {
  console.log(`
${colors.bright}🚀 Gerenciador de Desenvolvimento - Backend SaaS Autonomia${colors.reset}

${colors.cyan}Comandos disponíveis:${colors.reset}

  ${colors.green}start-docker${colors.reset}     Iniciar container PostgreSQL
  ${colors.green}stop-docker${colors.reset}      Parar container PostgreSQL  
  ${colors.green}setup-db${colors.reset}         Configurar banco (migrações + dados)
  ${colors.green}start-api${colors.reset}        Iniciar servidor da API
  ${colors.green}test${colors.reset}             Testar endpoint básico
  ${colors.green}test-all${colors.reset}         Testar todos os endpoints
  ${colors.green}reset${colors.reset}            Reset completo do ambiente
  ${colors.green}full-start${colors.reset}       Iniciar tudo (docker + db + api)
  ${colors.green}help${colors.reset}             Mostrar esta ajuda

${colors.cyan}Exemplos:${colors.reset}
  node dev-manager.js full-start
  node dev-manager.js test
  node dev-manager.js reset

${colors.cyan}URLs importantes:${colors.reset}
  API: http://localhost:3001
  Banco: localhost:5432
  
${colors.cyan}Email para testes:${colors.reset}
  adfelipevs@gmail.com
`);
}

async function fullStart() {
  log('blue', '🚀', 'Iniciando ambiente completo...');
  
  try {
    await startDocker();
    await setupDatabase();
    await startAPI();
  } catch (error) {
    log('red', '❌', 'Erro ao iniciar ambiente completo');
    process.exit(1);
  }
}

// Processar comando
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'start-docker':
      await startDocker();
      break;
      
    case 'stop-docker':
      await stopDocker();
      break;
      
    case 'setup-db':
      await setupDatabase();
      break;
      
    case 'start-api':
      await startAPI();
      break;
      
    case 'test':
      await testAPI();
      break;
      
    case 'test-all':
      await testAllEndpoints();
      break;
      
    case 'reset':
      await resetEnvironment();
      break;
      
    case 'full-start':
      await fullStart();
      break;
      
    case 'help':
    case undefined:
      showHelp();
      break;
      
    default:
      log('red', '❌', `Comando desconhecido: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// Executar
main().catch(error => {
  log('red', '❌', `Erro: ${error.message}`);
  process.exit(1);
});
