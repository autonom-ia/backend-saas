const http = require('http');

// Testar requisição OPTIONS (preflight)
function testPreflight() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: '/login',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Testar requisição POST real
function testLogin() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'adfelipevs@gmail.com',
      password: 'test'
    });
    
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testando CORS Preflight...\n');
  
  try {
    // Teste 1: OPTIONS (preflight)
    console.log('1️⃣ Testando requisição OPTIONS...');
    const preflightResult = await testPreflight();
    console.log(`   Status: ${preflightResult.statusCode}`);
    console.log(`   CORS Origin: ${preflightResult.headers['access-control-allow-origin']}`);
    console.log(`   CORS Methods: ${preflightResult.headers['access-control-allow-methods']}`);
    console.log(`   CORS Headers: ${preflightResult.headers['access-control-allow-headers']}`);
    
    if (preflightResult.statusCode === 204 || preflightResult.statusCode === 200) {
      console.log('   ✅ Preflight OK\n');
    } else {
      console.log('   ❌ Preflight falhou\n');
    }
    
    // Teste 2: POST real
    console.log('2️⃣ Testando requisição POST...');
    const loginResult = await testLogin();
    console.log(`   Status: ${loginResult.statusCode}`);
    console.log(`   CORS Origin: ${loginResult.headers['access-control-allow-origin']}`);
    
    if (loginResult.statusCode === 200) {
      console.log('   ✅ Login OK');
      const response = JSON.parse(loginResult.body);
      console.log(`   📧 Email: ${response.email}`);
      console.log(`   🔑 Token: ${response.AccessToken ? 'Presente' : 'Ausente'}`);
    } else {
      console.log('   ❌ Login falhou');
      console.log(`   📄 Body: ${loginResult.body}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

runTests();
