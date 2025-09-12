/**
 * Script para testar as rotas API do módulo settings
 * 
 * Este script testa todas as rotas disponíveis no módulo settings:
 * - GET /Autonomia/Settings/GetProductAccount
 * - GET /Autonomia/Settings/GetProductAccountByAccountPhone
 * - GET /Autonomia/Settings/ListAccounts
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

// Configurações
const API_BASE_URL = process.env.API_URL || 'https://api-settings.autonomia.site';
const MOCK_DIR = path.join(__dirname, 'mocks');

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

// Função para testar uma rota GET
const testGetRoute = async (routeName, endpoint, mockFile, params = {}) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota GET ${routeName}...`));
    
    const mockRequest = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, mockFile), 'utf8'));
    const queryParams = mockRequest.queryStringParameters || {};
    const pathParams = mockRequest.pathParameters || {};
    
    // Substituir valores em path parameters
    let finalEndpoint = endpoint;
    Object.keys(pathParams).forEach(key => {
      finalEndpoint = finalEndpoint.replace(`{${key}}`, pathParams[key]);
    });
    
    // Adicionar parametros customizados
    Object.keys(params).forEach(key => {
      queryParams[key] = params[key];
    });
    
    console.log(chalk.gray('Request URL:'), `${API_BASE_URL}${finalEndpoint}`);
    console.log(chalk.gray('Query Params:'), queryParams);
    
    const startTime = Date.now();
    const response = await axios.get(`${API_BASE_URL}${finalEndpoint}`, { params: queryParams });
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

// Função para testar uma rota PATCH
const testPatchRoute = async (routeName, endpoint, mockFile) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota PATCH ${routeName}...`));
    
    const mockRequest = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, mockFile), 'utf8'));
    const requestBody = mockRequest.body ? JSON.parse(mockRequest.body) : {};
    const pathParams = mockRequest.pathParameters || {};
    
    // Substituir valores em path parameters
    let finalEndpoint = endpoint;
    Object.keys(pathParams).forEach(key => {
      finalEndpoint = finalEndpoint.replace(`{${key}}`, pathParams[key]);
    });
    
    console.log(chalk.gray('Request URL:'), `${API_BASE_URL}${finalEndpoint}`);
    console.log(chalk.gray('Request Body:'), requestBody);
    
    const startTime = Date.now();
    const response = await axios.patch(`${API_BASE_URL}${finalEndpoint}`, requestBody);
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
  console.log(chalk.magenta.bold('\n🚀 INICIANDO TESTES DE API DO MÓDULO SETTINGS 🚀'));
  console.log(chalk.yellow(`\nAPI URL Base: ${API_BASE_URL}`));
  console.log(chalk.yellow('\nPara usar um valor diferente, defina a variável de ambiente API_URL'));
  
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

    // Teste 1: GetProductAccount
    console.log(chalk.cyan.bold('\n\n📋 TESTE 1: GetProductAccount'));
    testsTotal++;
    const productAccountResult = await testGetRoute(
      'GetProductAccount', 
      '/Autonomia/Settings/GetProductAccount', 
      'product-account-request.json'
    );
    if (productAccountResult) testsPassed++; else testsFailed++;
    
    // Teste 2: GetProductAccountByAccountPhone
    console.log(chalk.cyan.bold('\n\n📋 TESTE 2: GetProductAccountByAccountPhone'));
    testsTotal++;
    const productAccountByPhoneResult = await testGetRoute(
      'GetProductAccountByAccountPhone', 
      '/Autonomia/Settings/GetProductAccountByAccountPhone', 
      'get-product-account-by-account-phone-request.json'
    );
    if (productAccountByPhoneResult) testsPassed++; else testsFailed++;
    
    // Teste 3: ListAccounts
    console.log(chalk.cyan.bold('\n\n📋 TESTE 3: ListAccounts'));
    testsTotal++;
    const listAccountsResult = await testGetRoute(
      'ListAccounts', 
      '/Autonomia/Settings/ListAccounts', 
      'list-accounts-request.json'
    );
    if (listAccountsResult) testsPassed++; else testsFailed++;
    
    // Mostrar resumo dos testes
    console.log('\n' + '='.repeat(80));
    console.log(chalk.magenta.bold('📊 RESUMO DOS TESTES'));
    console.log('='.repeat(80));
    console.log(chalk.bold(`Total de testes: ${chalk.blue(testsTotal)}`));
    console.log(chalk.bold(`Testes com sucesso: ${chalk.green(testsPassed)}`));
    console.log(chalk.bold(`Testes com falha: ${chalk.red(testsFailed)}`));
    console.log(chalk.bold(`Taxa de sucesso: ${chalk.yellow(Math.round((testsPassed/testsTotal)*100))}%`));
    console.log('='.repeat(80));
    
    console.log(chalk.magenta.bold('\n🏁 TODOS OS TESTES CONCLUÍDOS 🏁\n'));
    
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
