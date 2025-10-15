const http = require('http');

// Simular exatamente a requisição que o frontend faz
async function testFrontendRequest() {
  console.log('🌐 Simulando requisição do frontend...\n');
  
  // Headers que o frontend normalmente envia
  const frontendHeaders = {
    'accept': '*/*',
    'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'origin': 'http://localhost:3000',
    'pragma': 'no-cache',
    'referer': 'http://localhost:3000/',
    'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'X-Dev-Email': 'adfelipevs@gmail.com'
  };
  
  const productId = '83678adb-39c4-444c-bfb3-d8955aab5d47';
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: `/Autonomia/Saas/Accounts?productId=${productId}`,
        method: 'GET',
        headers: frontendHeaders
      }, (res) => {
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
    
    console.log(`📊 Status: ${response.statusCode}`);
    console.log(`🔍 CORS Headers:`);
    console.log(`   Access-Control-Allow-Origin: ${response.headers['access-control-allow-origin']}`);
    console.log(`   Access-Control-Allow-Credentials: ${response.headers['access-control-allow-credentials']}`);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log(`\n✅ Sucesso! Contas encontradas: ${data.data ? data.data.length : 0}`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📋 Contas retornadas:');
        data.data.forEach((account, index) => {
          console.log(`   ${index + 1}. ${account.social_name || account.name} (${account.id})`);
        });
      } else {
        console.log('\n⚠️  Array de contas está vazio!');
      }
      
      // Mostrar estrutura completa da resposta
      console.log('\n🔍 Estrutura da resposta:');
      console.log(JSON.stringify(data, null, 2));
      
    } else {
      console.log(`\n❌ Erro: ${response.statusCode}`);
      console.log(`📄 Body: ${response.body}`);
    }
    
  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
}

// Também testar um OPTIONS request (preflight)
async function testPreflightRequest() {
  console.log('\n🔍 Testando requisição OPTIONS (preflight)...\n');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/Autonomia/Saas/Accounts',
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'content-type,x-dev-email'
        }
      }, (res) => {
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
    
    console.log(`📊 Preflight Status: ${response.statusCode}`);
    console.log(`🔍 CORS Headers:`);
    console.log(`   Access-Control-Allow-Origin: ${response.headers['access-control-allow-origin']}`);
    console.log(`   Access-Control-Allow-Methods: ${response.headers['access-control-allow-methods']}`);
    console.log(`   Access-Control-Allow-Headers: ${response.headers['access-control-allow-headers']}`);
    
  } catch (error) {
    console.error('❌ Erro no preflight:', error.message);
  }
}

async function runTests() {
  await testFrontendRequest();
  await testPreflightRequest();
  
  console.log('\n💡 Se as contas estão aparecendo aqui mas não no frontend:');
  console.log('   1. Verifique se o frontend está usando a URL correta');
  console.log('   2. Verifique se o frontend está enviando o header X-Dev-Email');
  console.log('   3. Verifique o console do browser para erros de CORS');
  console.log('   4. Verifique se o frontend está fazendo parse correto da resposta');
}

runTests();
