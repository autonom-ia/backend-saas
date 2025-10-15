#!/usr/bin/env node
/**
 * Inicializador Completo do Projeto Autonomia
 * 
 * Este script inicia todo o ambiente de desenvolvimento:
 * - PostgreSQL (Docker)
 * - Backend SaaS (porta 3001)
 * - Backend Auth (porta 3003)
 * - Frontend React (porta 3000)
 * 
 * Uso: node start-project.js
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

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
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${emoji} ${message}${colors.reset}`);
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

// Verificar se porta está em uso
function checkPort(port) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(port, (err) => {
      if (err) {
        resolve(false); // Porta em uso
      } else {
        server.once('close', () => resolve(true)); // Porta livre
        server.close();
      }
    });
    server.on('error', () => resolve(false));
  });
}

// Aguardar serviço ficar disponível
function waitForService(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = () => {
      attempts++;
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve(true);
      });
      
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          reject(new Error(`Serviço na porta ${port} não ficou disponível`));
        }
      });
      
      req.end();
    };
    
    check();
  });
}

// Processos ativos
const processes = [];

// Função para limpar processos ao sair
function cleanup() {
  log('yellow', '🧹', 'Finalizando processos...');
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      try {
        process.kill(-proc.pid); // Mata o grupo de processos
      } catch (e) {
        // Ignorar erros
      }
    }
  });
  process.exit(0);
}

// Handlers para finalização
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// 1. Iniciar PostgreSQL
async function startPostgreSQL() {
  log('blue', '🐘', 'Iniciando PostgreSQL...');
  
  try {
    // Verificar se container já existe
    try {
      await execCommand('docker start autonomia-postgres');
      log('green', '✅', 'Container PostgreSQL iniciado!');
    } catch (e) {
      // Se não existe, criar novo
      log('yellow', '📦', 'Criando container PostgreSQL...');
      await execCommand(`docker run -d \
        --name autonomia-postgres \
        -e POSTGRES_DB=autonomia_db \
        -e POSTGRES_USER=autonomia_admin \
        -e POSTGRES_PASSWORD=autonomia123 \
        -p 5432:5432 \
        postgres:14`);
      log('green', '✅', 'Container PostgreSQL criado!');
    }
    
    // Aguardar banco ficar pronto
    log('yellow', '⏳', 'Aguardando PostgreSQL ficar pronto...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return true;
  } catch (error) {
    log('red', '❌', `Erro ao iniciar PostgreSQL: ${error.error?.message || error.message}`);
    return false;
  }
}

// 2. Configurar banco de dados
async function setupDatabase() {
  log('blue', '🗄️', 'Configurando banco de dados...');
  
  try {
    const result = await execCommand('node setup-local-completo.js');
    log('green', '✅', 'Banco configurado com sucesso!');
    return true;
  } catch (error) {
    log('red', '❌', `Erro ao configurar banco: ${error.error?.message || error.stderr}`);
    return false;
  }
}

// 3. Iniciar Backend Auth
async function startBackendAuth() {
  log('blue', '🔐', 'Iniciando Backend Auth (porta 3003)...');
  
  const authPath = path.join(__dirname, 'api', 'auth');
  
  // Verificar se dependências estão instaladas
  if (!fs.existsSync(path.join(authPath, 'node_modules'))) {
    log('yellow', '📦', 'Instalando dependências Auth...');
    await execCommand('npm install', authPath);
  }
  
  const authProcess = spawn('npx', ['serverless', 'offline', 'start', '--config', 'serverless.local.yml'], {
    cwd: authPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
  
  processes.push(authProcess);
  
  authProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Server ready')) {
      log('green', '✅', 'Backend Auth iniciado com sucesso!');
    }
  });
  
  authProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('EADDRINUSE')) {
      log('red', '❌', 'Porta 3003 já está em uso!');
    }
  });
  
  return authProcess;
}

// 4. Iniciar Backend SaaS
async function startBackendSaaS() {
  log('blue', '🚀', 'Iniciando Backend SaaS (porta 3001)...');
  
  const saasPath = path.join(__dirname, 'api', 'saas');
  
  // Verificar se dependências estão instaladas
  if (!fs.existsSync(path.join(saasPath, 'node_modules'))) {
    log('yellow', '📦', 'Instalando dependências SaaS...');
    await execCommand('npm install', saasPath);
  }
  
  const saasProcess = spawn('npx', ['serverless', 'offline', 'start', '--config', 'serverless.local.yml'], {
    cwd: saasPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
  
  processes.push(saasProcess);
  
  saasProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Server ready')) {
      log('green', '✅', 'Backend SaaS iniciado com sucesso!');
    }
  });
  
  saasProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('EADDRINUSE')) {
      log('red', '❌', 'Porta 3001 já está em uso!');
    }
  });
  
  return saasProcess;
}

// 5. Iniciar Frontend
async function startFrontend() {
  log('blue', '⚛️', 'Iniciando Frontend React (porta 3000)...');
  
  const frontendPath = path.join(__dirname, 'frontend-saas');
  
  // Verificar se diretório do frontend existe
  if (!fs.existsSync(frontendPath)) {
    log('red', '❌', 'Diretório frontend-saas não encontrado!');
    log('yellow', '💡', 'Certifique-se que o frontend está na pasta frontend-saas/');
    return null;
  }
  
  // Verificar se dependências estão instaladas
  if (!fs.existsSync(path.join(frontendPath, 'node_modules'))) {
    log('yellow', '📦', 'Instalando dependências Frontend...');
    try {
      await execCommand('npm install', frontendPath);
    } catch (error) {
      log('red', '❌', 'Erro ao instalar dependências do frontend');
      return null;
    }
  }
  
  // Verificar se tem package.json
  const packageJsonPath = path.join(frontendPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('red', '❌', 'package.json não encontrado no frontend!');
    return null;
  }
  
  const frontendProcess = spawn('npm', ['start'], {
    cwd: frontendPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...process.env, BROWSER: 'none' } // Não abrir browser automaticamente
  });
  
  processes.push(frontendProcess);
  
  frontendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('webpack compiled') || output.includes('Local:')) {
      log('green', '✅', 'Frontend iniciado com sucesso!');
    }
  });
  
  frontendProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('EADDRINUSE')) {
      log('red', '❌', 'Porta 3000 já está em uso!');
    }
  });
  
  return frontendProcess;
}

// 6. Validar serviços
async function validateServices() {
  log('blue', '🔍', 'Validando serviços...');
  
  const services = [
    { name: 'PostgreSQL', port: 5432 },
    { name: 'Frontend', port: 3000 },
    { name: 'Backend SaaS', port: 3001 },
    { name: 'Backend Auth', port: 3003 }
  ];
  
  for (const service of services) {
    try {
      const isAvailable = !(await checkPort(service.port));
      if (isAvailable) {
        log('green', '✅', `${service.name} rodando na porta ${service.port}`);
      } else {
        log('red', '❌', `${service.name} não está rodando na porta ${service.port}`);
      }
    } catch (error) {
      log('red', '❌', `Erro ao verificar ${service.name}: ${error.message}`);
    }
  }
}

// Função principal
async function startProject() {
  console.log('\n');
  console.log(`${colors.bright}${colors.cyan}🚀 INICIANDO PROJETO AUTONOMIA COMPLETO${colors.reset}`);
  console.log('='.repeat(60));
  
  try {
    // 1. PostgreSQL
    const dbStarted = await startPostgreSQL();
    if (!dbStarted) {
      log('red', '❌', 'Falha ao iniciar PostgreSQL. Abortando...');
      return;
    }
    
    // 2. Configurar banco
    const dbConfigured = await setupDatabase();
    if (!dbConfigured) {
      log('yellow', '⚠️', 'Falha ao configurar banco, mas continuando...');
    }
    
    // 3. Iniciar backends (paralelo)
    log('blue', '🔄', 'Iniciando backends...');
    const authProcess = await startBackendAuth();
    await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar um pouco
    const saasProcess = await startBackendSaaS();
    
    // 4. Aguardar backends ficarem prontos
    log('yellow', '⏳', 'Aguardando backends ficarem prontos...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 5. Iniciar frontend
    const frontendProcess = await startFrontend();
    
    // 6. Aguardar frontend ficar pronto
    log('yellow', '⏳', 'Aguardando frontend ficar pronto...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // 7. Validar serviços
    await validateServices();
    
    // 8. Mostrar resumo
    console.log('\n' + '='.repeat(60));
    log('green', '🎉', 'PROJETO INICIADO COM SUCESSO!');
    console.log('='.repeat(60));
    log('cyan', '🌐', 'URLs disponíveis:');
    log('cyan', '   ', '• Frontend:     http://localhost:3000');
    log('cyan', '   ', '• Backend SaaS: http://localhost:3001');
    log('cyan', '   ', '• Backend Auth: http://localhost:3003');
    log('cyan', '   ', '• PostgreSQL:   localhost:5432');
    console.log('');
    log('yellow', '💡', 'Para parar todos os serviços: Ctrl+C');
    log('yellow', '💡', 'Para testar APIs: npm run validate');
    console.log('='.repeat(60));
    
    // Manter o script rodando
    process.stdin.resume();
    
  } catch (error) {
    log('red', '❌', `Erro ao iniciar projeto: ${error.message}`);
    cleanup();
  }
}

// Verificar se Docker está disponível
async function checkDocker() {
  try {
    await execCommand('docker --version');
    return true;
  } catch (error) {
    log('red', '❌', 'Docker não está instalado ou não está rodando!');
    log('yellow', '💡', 'Instale o Docker Desktop e tente novamente.');
    return false;
  }
}

// Iniciar
async function main() {
  const dockerAvailable = await checkDocker();
  if (!dockerAvailable) {
    process.exit(1);
  }
  
  await startProject();
}

main();
