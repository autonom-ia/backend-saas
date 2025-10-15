#!/usr/bin/env node
/**
 * Monitor de Requisições - Verifica se o frontend está fazendo requisições para o backend local
 */

const http = require('http');
const url = require('url');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color, emoji, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${emoji} ${message}${colors.reset}`);
}

// Contador de requisições
let requestCount = 0;
const requestStats = {
  campaigns: 0,
  templates: 0,
  accounts: 0,
  other: 0
};

// Função para analisar requisição
function analyzeRequest(method, path, headers) {
  requestCount++;
  
  // Identificar tipo de endpoint
  let endpointType = 'other';
  if (path.includes('Campaigns')) {
    endpointType = 'campaigns';
    requestStats.campaigns++;
  } else if (path.includes('TemplateMessages')) {
    endpointType = 'templates';
    requestStats.templates++;
  } else if (path.includes('Accounts')) {
    endpointType = 'accounts';
    requestStats.accounts++;
  } else {
    requestStats.other++;
  }
  
  // Log da requisição
  const color = method === 'POST' ? 'green' : method === 'GET' ? 'blue' : 'yellow';
  log(color, '📡', `${method} ${path}`);
  
  // Verificar headers importantes
  const origin = headers.origin || headers.Origin;
  const devEmail = headers['x-dev-email'] || headers['X-Dev-Email'];
  
  if (origin) {
    log('cyan', '🌐', `Origin: ${origin}`);
  }
  
  if (devEmail) {
    log('cyan', '👤', `Dev Email: ${devEmail}`);
  } else {
    log('red', '⚠️', 'Header X-Dev-Email não encontrado!');
  }
  
  // Verificar se é requisição do frontend esperado
  if (origin === 'http://localhost:3000') {
    log('green', '✅', 'Requisição do frontend local detectada!');
  } else if (origin && origin.includes('localhost')) {
    log('yellow', '⚠️', `Origem localhost diferente: ${origin}`);
  } else {
    log('red', '❌', `Origem não é localhost: ${origin || 'não informada'}`);
  }
  
  console.log(''); // Linha em branco
  
  return endpointType;
}

// Interceptar requisições HTTP
const originalRequest = http.request;
http.request = function(options, callback) {
  // Verificar se é requisição para nosso backend
  const isLocalBackend = (
    (options.hostname === 'localhost' || options.hostname === '127.0.0.1') &&
    (options.port === 3001 || options.port === '3001')
  );
  
  if (isLocalBackend) {
    const method = options.method || 'GET';
    const path = options.path || '/';
    const headers = options.headers || {};
    
    analyzeRequest(method, path, headers);
  }
  
  return originalRequest.call(this, options, callback);
};

// Criar servidor proxy simples para monitorar
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Dev-Email, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Analisar requisição
  analyzeRequest(req.method, req.url, req.headers);
  
  // Proxy para o backend real
  const backendOptions = {
    hostname: 'localhost',
    port: 3001,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'X-Dev-Email': 'adfelipevs@gmail.com' // Garantir header
    }
  };
  
  const proxyReq = http.request(backendOptions, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    log('red', '❌', `Erro no proxy: ${err.message}`);
    res.writeHead(500);
    res.end('Proxy Error');
  });
  
  req.pipe(proxyReq);
});

// Função para mostrar estatísticas
function showStats() {
  console.log('\n' + '='.repeat(50));
  log('cyan', '📊', 'ESTATÍSTICAS DE REQUISIÇÕES');
  console.log('='.repeat(50));
  log('blue', '📈', `Total de requisições: ${requestCount}`);
  log('green', '🎯', `Campaigns: ${requestStats.campaigns}`);
  log('magenta', '💬', `Templates: ${requestStats.templates}`);
  log('yellow', '👥', `Accounts: ${requestStats.accounts}`);
  log('cyan', '📋', `Outras: ${requestStats.other}`);
  console.log('='.repeat(50));
}

// Mostrar estatísticas a cada 30 segundos
setInterval(showStats, 30000);

// Iniciar monitor
const PORT = 3002;
server.listen(PORT, () => {
  console.log('\n' + '🔍 MONITOR DE REQUISIÇÕES INICIADO'.padStart(40));
  console.log('='.repeat(50));
  log('green', '🚀', `Monitor rodando na porta ${PORT}`);
  log('cyan', '💡', 'Para usar o monitor:');
  log('cyan', '   ', '1. Configure o frontend para usar http://localhost:3002');
  log('cyan', '   ', '2. O monitor fará proxy para http://localhost:3001');
  log('cyan', '   ', '3. Todas as requisições serão logadas aqui');
  log('yellow', '⚠️', 'Para parar: Ctrl+C');
  console.log('='.repeat(50));
  
  // Verificar se backend está rodando
  const testReq = http.request({
    hostname: 'localhost',
    port: 3001,
    path: '/Autonomia/Saas/Products',
    method: 'GET',
    headers: { 'X-Dev-Email': 'adfelipevs@gmail.com' }
  }, (res) => {
    if (res.statusCode === 200) {
      log('green', '✅', 'Backend local detectado e funcionando!');
    } else {
      log('yellow', '⚠️', `Backend respondeu com status ${res.statusCode}`);
    }
  });
  
  testReq.on('error', () => {
    log('red', '❌', 'Backend local não está rodando!');
    log('cyan', '💡', 'Execute: npm run start-saas');
  });
  
  testReq.end();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n');
  showStats();
  log('yellow', '👋', 'Monitor finalizado!');
  process.exit(0);
});
