const http = require('http');

// Função para fazer requisição HTTP com mais detalhes
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Fazendo requisição: ${options.method} ${options.hostname}:${options.port}${options.path}`);
    console.log(`📋 Headers:`, options.headers);
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`📥 Response Status: ${res.statusCode}`);
        console.log(`📥 Response Headers:`, res.headers);
        console.log(`📥 Response Body: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`);
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Request Error:`, error);
      reject(error);
    });
    
    req.end();
  });
}

// Testar diferentes variações da API de Accounts
async function debugAccounts() {
  console.log('🔍 DEBUG - API de Contas\n');
  console.log('=' .repeat(60));
  
  const productId = '83678adb-39c4-444c-bfb3-d8955aab5d47';
  const baseHeaders = {
    'X-Dev-Email': 'adfelipevs@gmail.com',
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000'
  };
  
  const tests = [
    {
      name: 'Accounts com productId (query)',
      path: `/Autonomia/Saas/Accounts?productId=${productId}`,
      headers: baseHeaders
    },
    {
      name: 'Accounts sem parâmetros',
      path: '/Autonomia/Saas/Accounts',
      headers: baseHeaders
    },
    {
      name: 'Accounts com headers mínimos',
      path: `/Autonomia/Saas/Accounts?productId=${productId}`,
      headers: {
        'X-Dev-Email': 'adfelipevs@gmail.com'
      }
    },
    {
      name: 'Accounts sem X-Dev-Email',
      path: `/Autonomia/Saas/Accounts?productId=${productId}`,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  ];
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n${i + 1}. 🧪 Teste: ${test.name}`);
    console.log('-' .repeat(40));
    
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: test.path,
        method: 'GET',
        headers: test.headers
      });
      
      if (response.statusCode === 200) {
        try {
          const data = JSON.parse(response.body);
          console.log(`✅ Sucesso! Contas encontradas: ${data.data ? data.data.length : 0}`);
          
          if (data.data && data.data.length > 0) {
            console.log(`📋 Primeira conta: ${data.data[0].social_name || data.data[0].name}`);
          }
        } catch (parseError) {
          console.log(`⚠️  Erro ao fazer parse do JSON: ${parseError.message}`);
        }
      } else {
        console.log(`❌ Erro: Status ${response.statusCode}`);
      }
      
    } catch (error) {
      console.log(`❌ Erro na requisição: ${error.message}`);
    }
    
    // Pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Debug concluído!');
  
  // Teste adicional: verificar se o servidor está respondendo
  console.log('\n🔍 Teste adicional: Health check');
  try {
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/Autonomia/Saas/Products',
      method: 'GET',
      headers: baseHeaders
    });
    
    console.log(`🏥 Health check: ${healthResponse.statusCode === 200 ? 'OK' : 'FALHOU'}`);
  } catch (error) {
    console.log(`🏥 Health check: FALHOU - ${error.message}`);
  }
}

debugAccounts();
