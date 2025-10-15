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

// Testar endpoint de login
async function testLogin() {
  console.log('🧪 Testando endpoint de login...\n');
  
  const loginData = {
    email: 'adfelipevs@gmail.com',
    password: 'qualquer-senha'
  };
  
  const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    }
  };
  
  try {
    const response = await makeRequest(options, JSON.stringify(loginData));
    
    console.log('✅ Status Code:', response.statusCode);
    console.log('📋 Headers:', JSON.stringify(response.headers, null, 2));
    console.log('📄 Body:', response.body);
    
    if (response.statusCode === 200) {
      console.log('\n🎉 API de Auth está funcionando corretamente!');
      console.log('🔐 Login em modo desenvolvimento (mock) ativo');
    } else {
      console.log('\n⚠️  API retornou status diferente de 200');
    }
    
  } catch (error) {
    console.error('❌ Erro ao fazer requisição:', error.message);
    console.log('\n💡 Certifique-se que a API Auth está rodando em http://localhost:3003');
    console.log('💡 Execute: npm run start-auth');
  }
}

// Executar teste
testLogin();
