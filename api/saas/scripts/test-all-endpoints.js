#!/usr/bin/env node
/**
 * Script para testar todos os endpoints da API SaaS
 * Uso: node scripts/test-all-endpoints.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const DEV_EMAIL = 'adfelipevs@gmail.com';

// Função para fazer requisições HTTP
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

// Função para testar um endpoint
async function testEndpoint(name, method, path, data = null) {
  console.log(`\n🧪 Testando: ${name}`);
  console.log(`   ${method} ${path}`);
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Email': DEV_EMAIL
    }
  };
  
  try {
    const response = await makeRequest(options, data ? JSON.stringify(data) : null);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`   ✅ Status: ${response.statusCode}`);
      
      // Mostrar dados se for GET
      if (method === 'GET' && response.body) {
        try {
          const parsed = JSON.parse(response.body);
          if (parsed.data && Array.isArray(parsed.data)) {
            console.log(`   📊 Retornou ${parsed.data.length} item(s)`);
          }
        } catch (e) {
          // Ignorar erro de parse
        }
      }
      
      return { success: true, response };
    } else {
      console.log(`   ⚠️  Status: ${response.statusCode}`);
      console.log(`   📄 Body: ${response.body.substring(0, 200)}...`);
      return { success: false, response };
    }
    
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return { success: false, error };
  }
}

// Lista de endpoints para testar
const endpoints = [
  // Produtos
  { name: 'Listar Produtos', method: 'GET', path: '/Autonomia/Saas/Products' },
  { name: 'Criar Produto', method: 'POST', path: '/Autonomia/Saas/Products', 
    data: { name: 'Produto Teste API', description: 'Criado via teste automatizado' } },
  
  // Accounts
  { name: 'Listar Contas', method: 'GET', path: '/Autonomia/Saas/Accounts?productId=83678adb-39c4-444c-bfb3-d8955aab5d47' },
  
  // Knowledge Documents
  { name: 'Listar Documentos', method: 'GET', path: '/Autonomia/Saas/KnowledgeDocuments' },
  
  // Product Parameters
  { name: 'Listar Parâmetros', method: 'GET', path: '/Autonomia/Saas/ProductParameters?productId=83678adb-39c4-444c-bfb3-d8955aab5d47' },
  
  // Conversation Funnels
  { name: 'Listar Funis', method: 'GET', path: '/Autonomia/Saas/ConversationFunnels' },
  
  // Inboxes
  { name: 'Listar Inboxes', method: 'GET', path: '/Autonomia/Saas/Inboxes?accountId=test' },
  
  // Kanban Items
  { name: 'Listar Kanban', method: 'GET', path: '/Autonomia/Saas/KanbanItems' }
];

// Função principal
async function runTests() {
  console.log('\n');
  console.log('🚀 TESTE AUTOMATIZADO - API SAAS AUTONOMIA');
  console.log('==========================================');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`👤 Email: ${DEV_EMAIL}`);
  console.log('\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(
      endpoint.name, 
      endpoint.method, 
      endpoint.path, 
      endpoint.data
    );
    
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
    
    // Pequena pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n');
  console.log('📊 RESUMO DOS TESTES');
  console.log('===================');
  console.log(`✅ Passou: ${passed}`);
  console.log(`❌ Falhou: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 Todos os testes passaram! API está funcionando perfeitamente.');
  } else {
    console.log(`\n⚠️  ${failed} teste(s) falharam. Verifique os logs acima.`);
  }
  
  console.log('\n💡 Para testar endpoints específicos, use:');
  console.log('   node test-api.js');
  console.log('   curl -X GET "http://localhost:3001/Autonomia/Saas/Products" -H "X-Dev-Email: adfelipevs@gmail.com"');
}

// Executar testes
runTests().catch(console.error);
