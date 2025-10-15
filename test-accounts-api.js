const http = require('http');

// Função para fazer requisição HTTP
function makeRequest(options) {
  return new Promise((resolve, reject) => {
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

// Testar API de contas
async function testAccountsAPI() {
  console.log('🧪 Testando API de Contas...\n');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/Autonomia/Saas/Accounts?productId=83678adb-39c4-444c-bfb3-d8955aab5d47',
      method: 'GET',
      headers: {
        'X-Dev-Email': 'adfelipevs@gmail.com',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log(`📊 Contas encontradas: ${data.data ? data.data.length : 0}`);
      
      if (data.data && data.data.length > 0) {
        console.log('\n📋 Lista de Contas:');
        console.log('=' .repeat(50));
        
        data.data.forEach((account, index) => {
          console.log(`${index + 1}. ${account.social_name || account.name}`);
          console.log(`   📧 Email: ${account.email}`);
          console.log(`   📱 Telefone: ${account.phone}`);
          console.log(`   🆔 ID: ${account.id}`);
          console.log('');
        });
        
        console.log('🎉 Perfeito! Agora você tem contas para selecionar na criação de campanhas!');
      } else {
        console.log('⚠️  Nenhuma conta encontrada. Execute: node populate-accounts.js');
      }
    } else {
      console.log('❌ Erro na API:', response.body);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
    console.log('\n💡 Certifique-se que a API SaaS está rodando:');
    console.log('   npm run start-saas');
  }
}

testAccountsAPI();
