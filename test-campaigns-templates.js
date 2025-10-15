const http = require('http');

// Função para fazer requisição HTTP
function makeRequest(options, postData = null) {
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
    if (postData) req.write(postData);
    req.end();
  });
}

// Testar criação de template de mensagem
async function testCreateTemplateMessage() {
  console.log('🧪 Testando criação de Template Message...\n');
  
  const templateData = {
    account_id: "1998cdb1-7f76-4d1e-a819-de760868baa7", // Digital Marketing Pro
    name: "Boas vindas " + Date.now(), // Nome único
    message_text: "Olá, como posso lhe ajudar?"
  };
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/Autonomia/Saas/TemplateMessages',
      method: 'POST',
      headers: {
        'X-Dev-Email': 'adfelipevs@gmail.com',
        'Content-Type': 'application/json'
      }
    }, JSON.stringify(templateData));
    
    console.log(`✅ Status: ${response.statusCode}`);
    
    if (response.statusCode === 201) {
      const data = JSON.parse(response.body);
      console.log('🎉 Template criado com sucesso!');
      console.log(`📝 Nome: ${data.data.name}`);
      console.log(`💬 Mensagem: ${data.data.message_text}`);
      console.log(`🆔 ID: ${data.data.id}\n`);
      return data.data;
    } else {
      console.log('❌ Erro:', response.body);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar template:', error.message);
    return null;
  }
}

// Testar criação de campanha
async function testCreateCampaign(templateId = null) {
  console.log('🧪 Testando criação de Campanha...\n');
  
  const campaignData = {
    name: "Campanha DEV " + Date.now(), // Nome único
    description: "Campanha de teste dev",
    account_id: "1998cdb1-7f76-4d1e-a819-de760868baa7", // Digital Marketing Pro
    template_message_id: templateId
  };
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/Autonomia/Saas/Campaigns',
      method: 'POST',
      headers: {
        'X-Dev-Email': 'adfelipevs@gmail.com',
        'Content-Type': 'application/json'
      }
    }, JSON.stringify(campaignData));
    
    console.log(`✅ Status: ${response.statusCode}`);
    
    if (response.statusCode === 201) {
      const data = JSON.parse(response.body);
      console.log('🎉 Campanha criada com sucesso!');
      console.log(`📝 Nome: ${data.data.name}`);
      console.log(`📄 Descrição: ${data.data.description}`);
      console.log(`🆔 ID: ${data.data.id}\n`);
      return data.data;
    } else {
      console.log('❌ Erro:', response.body);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar campanha:', error.message);
    return null;
  }
}

// Testar listagem de templates
async function testListTemplateMessages() {
  console.log('🧪 Testando listagem de Template Messages...\n');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/Autonomia/Saas/TemplateMessages?accountId=1998cdb1-7f76-4d1e-a819-de760868baa7',
      method: 'GET',
      headers: {
        'X-Dev-Email': 'adfelipevs@gmail.com',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log(`📊 Templates encontrados: ${data.data.length}`);
      
      data.data.forEach((template, index) => {
        console.log(`${index + 1}. ${template.name}`);
        console.log(`   💬 Mensagem: ${template.message_text}`);
        console.log(`   🆔 ID: ${template.id}\n`);
      });
    } else {
      console.log('❌ Erro:', response.body);
    }
    
  } catch (error) {
    console.error('❌ Erro ao listar templates:', error.message);
  }
}

// Testar listagem de campanhas
async function testListCampaigns() {
  console.log('🧪 Testando listagem de Campanhas...\n');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/Autonomia/Saas/Campaigns?accountId=1998cdb1-7f76-4d1e-a819-de760868baa7',
      method: 'GET',
      headers: {
        'X-Dev-Email': 'adfelipevs@gmail.com',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log(`📊 Campanhas encontradas: ${data.data.length}`);
      
      data.data.forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.name}`);
        console.log(`   📄 Descrição: ${campaign.description}`);
        console.log(`   📝 Template: ${campaign.template_name || 'Nenhum'}`);
        console.log(`   🆔 ID: ${campaign.id}\n`);
      });
    } else {
      console.log('❌ Erro:', response.body);
    }
    
  } catch (error) {
    console.error('❌ Erro ao listar campanhas:', error.message);
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log('🚀 TESTANDO ENDPOINTS DE CAMPANHAS E TEMPLATES\n');
  console.log('=' .repeat(60));
  
  // 1. Criar template de mensagem
  const template = await testCreateTemplateMessage();
  
  // 2. Criar campanha (com ou sem template)
  const campaign = await testCreateCampaign(template?.id);
  
  // 3. Listar templates
  await testListTemplateMessages();
  
  // 4. Listar campanhas
  await testListCampaigns();
  
  console.log('=' .repeat(60));
  console.log('✅ Testes concluídos!');
  console.log('\n💡 URLs para o frontend:');
  console.log('   POST http://localhost:3001/Autonomia/Saas/TemplateMessages');
  console.log('   POST http://localhost:3001/Autonomia/Saas/Campaigns');
  console.log('   GET  http://localhost:3001/Autonomia/Saas/TemplateMessages?accountId={id}');
  console.log('   GET  http://localhost:3001/Autonomia/Saas/Campaigns?accountId={id}');
}

runAllTests();
