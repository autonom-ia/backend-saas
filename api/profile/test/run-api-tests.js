/**
 * Script para testar as rotas API do módulo profile
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const aws4 = require('aws4');
const { URL } = require('url');

// Importar os módulos de teste
const testUsers = require('./users.test');

// Configurações
const API_BASE_URL = process.env.API_URL || 'https://api-profile.autonomia.site';
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
    testsPassed++;
  } else {
    console.log(chalk.red.bold(`❌ TESTE FALHOU: ${testName}`));
    testsFailed++;
  }
  testsTotal++;
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

// Funções auxiliares para os testes
const testGetRoute = async (routeName, endpoint, params = {}) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota GET ${routeName}...`));
    let finalEndpoint = endpoint;
    Object.keys(params.path || {}).forEach(key => {
      finalEndpoint = finalEndpoint.replace(`{${key}}`, params.path[key]);
    });

    const url = new URL(`${API_BASE_URL}${finalEndpoint}`);
    if (params.query) {
      Object.keys(params.query).forEach(key => url.searchParams.append(key, params.query[key]));
    }

    const request = {
      host: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      service: 'execute-api',
      region: 'us-east-1',
    };

    const signedRequest = aws4.sign(request);

    console.log(chalk.gray('Request URL:'), url.toString());
    console.log(chalk.gray('Query Params:'), params.query || {});

    const startTime = Date.now();
    const response = await axios.get(url.toString(), { headers: signedRequest.headers });
    const endTime = Date.now();

    console.log(chalk.gray('Tempo de resposta:'), `${endTime - startTime}ms`);
    displayResult(routeName, true, response.data);
    return response.data;
  } catch (error) {
    displayResult(routeName, false, null, error);
    return null;
  }
};

const testPostRoute = async (routeName, endpoint, mockFile) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota POST ${routeName}...`));
    const mockRequest = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, mockFile), 'utf8'));
    const requestBody = mockRequest.body || {};
    const bodyString = JSON.stringify(requestBody);

    const url = new URL(`${API_BASE_URL}${endpoint}`);
    const request = {
      host: url.hostname,
      path: url.pathname,
      method: 'POST',
      service: 'execute-api',
      region: 'us-east-1',
      body: bodyString,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const signedRequest = aws4.sign(request);

    console.log(chalk.gray('Request URL:'), url.toString());
    console.log(chalk.gray('Request Body:'), requestBody);

    const startTime = Date.now();
    const response = await axios.post(url.toString(), requestBody, { headers: signedRequest.headers });
    const endTime = Date.now();

    console.log(chalk.gray('Tempo de resposta:'), `${endTime - startTime}ms`);
    displayResult(routeName, true, response.data);
    return response.data;
  } catch (error) {
    displayResult(routeName, false, null, error);
    return null;
  }
};

const testPutRoute = async (routeName, endpoint, mockFile, pathParams = {}) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota PUT ${routeName}...`));
    const mockRequest = JSON.parse(fs.readFileSync(path.join(MOCK_DIR, mockFile), 'utf8'));
    const requestBody = mockRequest.body || {};
    const bodyString = JSON.stringify(requestBody);

    let finalEndpoint = endpoint;
    Object.keys(pathParams).forEach(key => {
      finalEndpoint = finalEndpoint.replace(`{${key}}`, pathParams[key]);
    });

    const url = new URL(`${API_BASE_URL}${finalEndpoint}`);
    const request = {
      host: url.hostname,
      path: url.pathname,
      method: 'PUT',
      service: 'execute-api',
      region: 'us-east-1',
      body: bodyString,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const signedRequest = aws4.sign(request);

    console.log(chalk.gray('Request URL:'), url.toString());
    console.log(chalk.gray('Request Body:'), requestBody);

    const startTime = Date.now();
    const response = await axios.put(url.toString(), requestBody, { headers: signedRequest.headers });
    const endTime = Date.now();

    console.log(chalk.gray('Tempo de resposta:'), `${endTime - startTime}ms`);
    displayResult(routeName, true, response.data);
    return response.data;
  } catch (error) {
    displayResult(routeName, false, null, error);
    return null;
  }
};

const testDeleteRoute = async (routeName, endpoint, pathParams = {}) => {
  try {
    console.log(chalk.blue(`\n📡 Testando rota DELETE ${routeName}...`));
    let finalEndpoint = endpoint;
    Object.keys(pathParams).forEach(key => {
      finalEndpoint = finalEndpoint.replace(`{${key}}`, pathParams[key]);
    });

    const url = new URL(`${API_BASE_URL}${finalEndpoint}`);
    const request = {
      host: url.hostname,
      path: url.pathname,
      method: 'DELETE',
      service: 'execute-api',
      region: 'us-east-1',
    };

    const signedRequest = aws4.sign(request);

    console.log(chalk.gray('Request URL:'), url.toString());

    const startTime = Date.now();
    const response = await axios.delete(url.toString(), { headers: signedRequest.headers });
    const endTime = Date.now();

    console.log(chalk.gray('Tempo de resposta:'), `${endTime - startTime}ms`);
    displayResult(routeName, true, response.data);
    return response.data;
  } catch (error) {
    displayResult(routeName, false, null, error);
    return null;
  }
};

// Contadores globais
let testsPassed = 0;
let testsFailed = 0;
let testsTotal = 0;

// Função principal
const runTests = async () => {
  console.log(chalk.magenta.bold('\n🚀 INICIANDO TESTES DE API DO MÓDULO PROFILE 🚀'));
  console.log(chalk.yellow(`\nAPI URL Base: ${API_BASE_URL}`));

  // Instalar dependências se necessário
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log(chalk.yellow('\n📦 Instalando dependências...'));
    require('child_process').execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log(chalk.green('✅ Dependências instaladas!'));
  }

  // Executar os testes de Users
  await testUsers({ testGetRoute, testPostRoute, testPutRoute, testDeleteRoute });

  // Resumo dos testes
  console.log('\n' + '='.repeat(80));
  console.log(chalk.magenta.bold('📊 RESUMO DOS TESTES'));
  console.log('='.repeat(80));
  console.log(chalk.green(`Total de Testes Passados: ${testsPassed}`));
  console.log(chalk.red(`Total de Testes Falhados: ${testsFailed}`));
  console.log(chalk.blue(`Total de Testes Executados: ${testsTotal}`));
  console.log('='.repeat(80) + '\n');

  // Sair com código de erro se algum teste falhar
  if (testsFailed > 0) {
    process.exit(1);
  }
};

runTests().catch(error => {
  console.error(chalk.red.bold('\n🚨 ERRO INESPERADO DURANTE A EXECUÇÃO DOS TESTES 🚨'));
  console.error(error);
  process.exit(1);
});
