#!/usr/bin/env node
/**
 * Script de Validação do Ambiente de Desenvolvimento
 * Verifica se todos os serviços estão rodando corretamente
 */

const http = require('http');
const { exec } = require('child_process');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, emoji, message) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
}

// Função para fazer requisição HTTP
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Verificar se porta está em uso
function checkPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      resolve(stdout.includes(`${port}`));
    });
  });
}

// Testar API SaaS
async function testSaasAPI() {
  log('blue', '🧪', 'Testando API SaaS...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/Autonomia/Saas/Products',
      method: 'GET',
      headers: {
        'X-Dev-Email': 'adfelipevs@gmail.com',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.statusCode === 200) {
      log('green', '✅', 'API SaaS funcionando (http://localhost:3001)');
      return true;
    } else {
      log('red', '❌', `API SaaS retornou status ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    log('red', '❌', `API SaaS não acessível: ${error.message}`);
    return false;
  }
}

// Testar API Auth
async function testAuthAPI() {
  log('blue', '🧪', 'Testando API Auth...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3003,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      }
    }, JSON.stringify({
      email: 'adfelipevs@gmail.com',
      password: 'test'
    }));
    
    if (response.statusCode === 200) {
      log('green', '✅', 'API Auth funcionando (http://localhost:3003)');
      return true;
    } else {
      log('red', '❌', `API Auth retornou status ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    log('red', '❌', `API Auth não acessível: ${error.message}`);
    return false;
  }
}

// Verificar banco PostgreSQL
async function testDatabase() {
  log('blue', '🧪', 'Testando conexão com PostgreSQL...');
  
  const isPortOpen = await checkPort(5432);
  if (isPortOpen) {
    log('green', '✅', 'PostgreSQL rodando (localhost:5432)');
    return true;
  } else {
    log('red', '❌', 'PostgreSQL não está rodando na porta 5432');
    return false;
  }
}

// Verificar CORS
async function testCORS() {
  log('blue', '🧪', 'Testando configuração CORS...');
  
  try {
    // Testar preflight request
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3003,
      path: '/login',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsHeader = response.headers['access-control-allow-origin'];
    if (corsHeader === 'http://localhost:3000') {
      log('green', '✅', 'CORS configurado corretamente');
      return true;
    } else {
      log('red', '❌', `CORS incorreto: ${corsHeader}`);
      return false;
    }
  } catch (error) {
    log('red', '❌', `Erro ao testar CORS: ${error.message}`);
    return false;
  }
}

// Função principal
async function validateEnvironment() {
  console.log('\n');
  log('cyan', '🔍', 'VALIDAÇÃO DO AMBIENTE DE DESENVOLVIMENTO');
  console.log('='.repeat(50));
  
  const tests = [
    { name: 'PostgreSQL', test: testDatabase },
    { name: 'API SaaS', test: testSaasAPI },
    { name: 'API Auth', test: testAuthAPI },
    { name: 'CORS', test: testCORS }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log('red', '❌', `Erro ao testar ${name}: ${error.message}`);
      failed++;
    }
    
    // Pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(50));
  log('cyan', '📊', 'RESUMO DA VALIDAÇÃO');
  log('green', '✅', `Testes aprovados: ${passed}`);
  log('red', '❌', `Testes falharam: ${failed}`);
  log('cyan', '📈', `Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n');
    log('green', '🎉', 'AMBIENTE TOTALMENTE FUNCIONAL!');
    log('cyan', '💡', 'Seu frontend pode conectar nas seguintes URLs:');
    log('cyan', '   ', '• Auth: http://localhost:3003');
    log('cyan', '   ', '• SaaS: http://localhost:3001');
    log('cyan', '   ', '• Use Origin: http://localhost:3000');
    log('cyan', '   ', '• Use Header: X-Dev-Email: adfelipevs@gmail.com');
  } else {
    console.log('\n');
    log('yellow', '⚠️', 'ALGUNS SERVIÇOS NÃO ESTÃO FUNCIONANDO');
    log('cyan', '💡', 'Para corrigir:');
    log('cyan', '   ', '1. npm run start-auth (Terminal 1)');
    log('cyan', '   ', '2. npm run start-saas (Terminal 2)');
    log('cyan', '   ', '3. Verificar se Docker está rodando');
    log('cyan', '   ', '4. node dev-manager.js start-docker');
  }
  
  console.log('\n');
}

// Executar validação
validateEnvironment().catch(error => {
  log('red', '❌', `Erro na validação: ${error.message}`);
  process.exit(1);
});
