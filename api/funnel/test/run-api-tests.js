/**
 * Script para testar as rotas API do módulo funnel
 * 
 * Este script testa todas as rotas disponíveis no módulo funnel:
 * - GET /Autonomia/Funnel/GetAccountFunnel
 * - POST /Autonomia/Funnel/CreateConversationRegister
 * - GET /Autonomia/Funnel/GetPendingMessages
 * - POST /Autonomia/Funnel/RegisterSentMessage
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

// Configurações
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'mocks/config.json'), 'utf8'));
const API_BASE_URL = process.env.API_URL || CONFIG.API_URL;
const MOCK_DIR = path.join(__dirname, 'mocks');
const REAL_ACCOUNT_ID = process.env.ACCOUNT_ID || CONFIG.ACCOUNT_ID;

// Formatar e exibir resultados
const formatResponse = (data) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return data;
  }
};

const displayResult = (testName, success, data, error = null) => {
  console.log('\n' + '='.repeat(80));
  if (success) {
    console.log(chalk.green.bold(`✅ TESTE SUCESSO: ${testName}`));
  } else {
    console.log(chalk.red.bold(`❌ TESTE FALHOU: ${testName}`));
  }
  console.log('='.repeat(80) + '\n');
  
  if (success) {
    console.log(chalk.cyan.bold('📋 Resposta:'));
    console.log(chalk.white(formatResponse(data)));
  } else {
    console.log(chalk.yellow.bold('⚠️ Erro:'));
    if (error?.response?.data) {
      console.log(chalk.red(formatResponse(error.response.data)));
      console.log(chalk.yellow.bold('\nCódigo de Status:'), chalk.red(error.response.status));
    } else {
      console.log(chalk.red(error.message || 'Erro desconhecido'));
    }
  }
};

// Atualizar os mock requests com valores reais
const updateMockRequestWithRealId = (filePath, accountId) => {
  try {
    const mockData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Atualizar accountId em queryStringParameters se existir
    if (mockData.queryStringParameters && mockData.queryStringParameters.accountId) {
      mockData.queryStringParameters.accountId = accountId;
    }
    
    return mockData;
  } catch (e) {
    console.error(`Erro ao processar arquivo mock ${filePath}:`, e.message);
    return null;
  }
};

// Função para testar uma rota GET
const testGetRoute = async (routeName, endpoint, mockFile) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota GET ${routeName}...`));
    
    const mockRequest = updateMockRequestWithRealId(path.join(MOCK_DIR, mockFile), REAL_ACCOUNT_ID);
    if (!mockRequest) return;
    
    const queryParams = mockRequest.queryStringParameters || {};
    
    console.log(chalk.gray('Request URL:'), `${API_BASE_URL}${endpoint}`);
    console.log(chalk.gray('Query Params:'), queryParams);
    
    const startTime = Date.now();
    const response = await axios.get(`${API_BASE_URL}${endpoint}`, { params: queryParams });
    const endTime = Date.now();
    
    console.log(chalk.gray('Tempo de resposta:'), `${endTime - startTime}ms`);
    displayResult(routeName, true, response.data);
    
    return response.data;
  } catch (error) {
    displayResult(routeName, false, null, error);
  }
};

// Função para testar uma rota POST
const testPostRoute = async (routeName, endpoint, mockFile) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota POST ${routeName}...`));
    
    const mockRequest = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, mockFile), 'utf8'));
    const requestBody = mockRequest.body ? JSON.parse(mockRequest.body) : {};
    
    console.log(chalk.gray('Request URL:'), `${API_BASE_URL}${endpoint}`);
    console.log(chalk.gray('Request Body:'), requestBody);
    
    const startTime = Date.now();
    const response = await axios.post(`${API_BASE_URL}${endpoint}`, requestBody);
    const endTime = Date.now();
    
    console.log(chalk.gray('Tempo de resposta:'), `${endTime - startTime}ms`);
    displayResult(routeName, true, response.data);
    
    return response.data;
  } catch (error) {
    displayResult(routeName, false, null, error);
  }
};

// Contadores globais para estatísticas de testes
let testsPassed = 0;
let testsFailed = 0;
let testsTotal = 0;

// Função principal de execução dos testes
const runTests = async () => {
  console.log(chalk.magenta.bold('\n🚀 INICIANDO TESTES DE API DO MÓDULO FUNNEL 🚀'));
  console.log(chalk.yellow(`\nAPI URL Base: ${API_BASE_URL}`));
  console.log(chalk.yellow(`ID da conta para teste: ${REAL_ACCOUNT_ID}`));
  console.log(chalk.yellow('\nPara usar valores diferentes, defina as variáveis de ambiente API_URL e ACCOUNT_ID'));
  
  try {
    // Instalar as dependências necessárias
    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
      console.log(chalk.yellow('\n📦 Instalando dependências necessárias...'));
      require('child_process').execSync('npm install axios chalk --no-save', { 
        stdio: 'inherit',
        cwd: __dirname
      });
      console.log(chalk.green('✅ Dependências instaladas com sucesso!'));
    }

    // Redefinir contadores
    testsPassed = 0;
    testsFailed = 0;
    testsTotal = 0;

    // Teste 1: GetAccountFunnel
    console.log(chalk.cyan.bold('\n\n📋 TESTE 1: GetAccountFunnel'));
    testsTotal++;
    const accountFunnelResult = await testGetRoute(
      'GetAccountFunnel', 
      '/Autonomia/Funnel/GetAccountFunnel', 
      'account-funnel-request.json'
    );
    if (accountFunnelResult) testsPassed++; else testsFailed++;
    
    // Teste 2: GetPendingMessages
    console.log(chalk.cyan.bold('\n\n📋 TESTE 2: GetPendingMessages'));
    testsTotal++;
    const pendingMessagesResult = await testGetRoute(
      'GetPendingMessages', 
      '/Autonomia/Funnel/GetPendingMessages', 
      'pending-messages-request.json'
    );
    if (pendingMessagesResult) testsPassed++; else testsFailed++;
    
    // Teste 3: CreateConversationRegister
    console.log(chalk.cyan.bold('\n\n📋 TESTE 3: CreateConversationRegister'));
    testsTotal++;
    const conversationRegisterResult = await testPostRoute(
      'CreateConversationRegister', 
      '/Autonomia/Funnel/CreateConversationRegister', 
      'conversation-register-request.json'
    );
    if (conversationRegisterResult) testsPassed++; else testsFailed++;
    
    // Teste 4: RegisterSentMessage
    console.log(chalk.cyan.bold('\n\n📋 TESTE 4: RegisterSentMessage'));
    testsTotal++;
    const registerSentMessageResult = await testPostRoute(
      'RegisterSentMessage', 
      '/Autonomia/Funnel/RegisterSentMessage', 
      'register-sent-message-request.json'
    );
    if (registerSentMessageResult) testsPassed++; else testsFailed++;
    
    // Mostrar resumo dos testes
    console.log('\n' + '='.repeat(80));
    console.log(chalk.magenta.bold('📊 RESUMO DOS TESTES'));
    console.log('='.repeat(80));
    console.log(chalk.bold(`Total de testes: ${chalk.blue(testsTotal)}`));
    console.log(chalk.bold(`Testes com sucesso: ${chalk.green(testsPassed)}`));
    console.log(chalk.bold(`Testes com falha: ${chalk.red(testsFailed)}`));
    console.log(chalk.bold(`Taxa de sucesso: ${chalk.yellow(Math.round((testsPassed/testsTotal)*100))}%`));
    console.log('='.repeat(80));
    
    console.log(chalk.magenta.bold('\n\n🏁 TODOS OS TESTES CONCLUÍDOS 🏁\n'));
    
    // Retornar código de saída baseado nos resultados
    if (testsFailed > 0) {
      process.exit(testsFailed);
    }
  } catch (error) {
    console.error(chalk.red.bold('\n❌ ERRO AO EXECUTAR TESTES:'), error.message);
    process.exit(1);
  }
};

// Executar testes
runTests();
