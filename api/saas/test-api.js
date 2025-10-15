const http = require('http');

// Função para fazer requisição HTTP
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Testar endpoint de produtos
async function testProductsEndpoint() {
  console.log('🧪 Testando endpoint de produtos...\n');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/Autonomia/Saas/Products',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Email': 'adfelipevs@gmail.com'
    }
  };
  
  try {
    const response = await makeRequest(options);
    
    console.log('✅ Status Code:', response.statusCode);
    console.log('📋 Headers:', JSON.stringify(response.headers, null, 2));
    console.log('📄 Body:', response.body);
    
    if (response.statusCode === 200) {
      console.log('\n🎉 API está funcionando corretamente!');
    } else {
      console.log('\n⚠️  API retornou status diferente de 200');
    }
    
  } catch (error) {
    console.error('❌ Erro ao fazer requisição:', error.message);
  }
}

// Executar teste
testProductsEndpoint();
