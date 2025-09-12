/**
 * Script para testar o endpoint ListAccounts
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Carregar configurações
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'mocks', 'config.json')));
const API_URL = config.API_URL;
const ENDPOINTS = config.ENDPOINTS;

// Função para testar o endpoint ListAccounts
async function testListAccounts() {
  try {
    console.log(chalk.cyan('🔍 Testando endpoint ListAccounts...'));
    
    // Construir URL completa
    const url = `${API_URL}${ENDPOINTS.listAccounts}`;
    console.log(chalk.gray(`URL: ${url}`));
    
    // Fazer requisição GET
    const response = await axios.get(url, {
      params: {
        limit: 10,
        offset: 0
      }
    });
    
    // Verificar resposta
    if (response.status === 200 && response.data.success) {
      console.log(chalk.green('✅ Teste bem-sucedido!'));
      console.log(chalk.gray('Mensagem:'), response.data.message);
      console.log(chalk.gray('Total de contas:'), response.data.data.length);
      
      // Verificar estrutura dos dados
      if (response.data.data.length > 0) {
        const firstItem = response.data.data[0];
        console.log(chalk.gray('\nEstrutura do primeiro item:'));
        console.log(chalk.gray('- account:'), Object.keys(firstItem.account || {}).join(', '));
        console.log(chalk.gray('- product:'), firstItem.product ? Object.keys(firstItem.product).join(', ') : 'null');
        
        // Verificar parâmetros na raiz
        const accountAndProductKeys = ['account', 'product'];
        const parameterKeys = Object.keys(firstItem).filter(key => !accountAndProductKeys.includes(key));
        console.log(chalk.gray('- parâmetros na raiz:'), parameterKeys.join(', '));
      }
      
      return true;
    } else {
      console.log(chalk.red('❌ Teste falhou!'));
      console.log(chalk.red('Resposta:'), response.data);
      return false;
    }
  } catch (error) {
    console.log(chalk.red('❌ Erro ao testar endpoint:'));
    if (error.response) {
      console.log(chalk.red('Status:'), error.response.status);
      console.log(chalk.red('Dados:'), error.response.data);
    } else {
      console.log(chalk.red(error.message));
    }
    return false;
  }
}

// Executar teste
(async () => {
  try {
    const result = await testListAccounts();
    console.log(chalk.cyan('\n📊 Resultado final:'), result ? chalk.green('SUCESSO') : chalk.red('FALHA'));
  } catch (error) {
    console.error(chalk.red('Erro não tratado:'), error);
  }
})();
