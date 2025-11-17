/**
 * Script para criar uma conta de teste no banco de dados
 * 
 * Uso:
 *   node shared/migrations/create-test-account.js
 *   node shared/migrations/create-test-account.js --domain portal.autonomia.site
 *   node shared/migrations/create-test-account.js --domain portal.autonomia.site --product-name "Produto Teste"
 */

const path = require('path');
const fs = require('fs');

// Carregar .env apenas se as variáveis não estiverem já definidas
if (!process.env.POSTGRES_HOST && !process.env.DB_HOST) {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

const knex = require('knex');

// Configuração do Knex
const dbConfig = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST,
    port: process.env.DB_PORT || process.env.POSTGRES_PORT || 5432,
    database: process.env.DB_NAME || process.env.POSTGRES_DATABASE,
    user: process.env.DB_USER || process.env.POSTGRES_USER,
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
    ssl: (process.env.DB_SSL_ENABLED === 'true' || process.env.POSTGRES_SSL === 'true') 
      ? { rejectUnauthorized: false } 
      : false
  }
};

const db = knex(dbConfig);

async function createTestAccount() {
  try {
    // Parse dos argumentos
    const args = process.argv.slice(2);
    const domainIndex = args.indexOf('--domain');
    const productNameIndex = args.indexOf('--product-name');
    
    const domain = domainIndex !== -1 && args[domainIndex + 1] 
      ? args[domainIndex + 1] 
      : 'portal.autonomia.site';
    
    const productName = productNameIndex !== -1 && args[productNameIndex + 1]
      ? args[productNameIndex + 1]
      : 'Produto Autonomia';

    console.log('====================================');
    console.log('Criando conta de teste');
    console.log('====================================');
    console.log(`Domínio: ${domain}`);
    console.log(`Produto: ${productName}`);
    console.log('');

    // Verificar se já existe uma conta com esse domínio
    const existingAccount = await db('account')
      .where({ domain })
      .orWhere('domain', 'like', `%${domain}%`)
      .first();

    if (existingAccount) {
      console.log(`⚠️  Já existe uma conta com o domínio: ${domain}`);
      console.log(`   ID: ${existingAccount.id}`);
      console.log(`   Nome: ${existingAccount.name || existingAccount.social_name || 'N/A'}`);
      console.log(`   Domínio atual: ${existingAccount.domain || 'N/A'}`);
      
      // Perguntar se quer atualizar o domínio
      console.log('');
      console.log('💡 Se o domínio estiver diferente, você pode atualizar manualmente:');
      console.log(`   UPDATE account SET domain = '${domain}' WHERE id = '${existingAccount.id}';`);
      
      await db.destroy();
      process.exit(0);
    }

    // Buscar ou criar um produto
    let product = await db('product').where({ name: productName }).first();
    
    if (!product) {
      console.log(`📦 Criando produto: ${productName}...`);
      const [newProduct] = await db('product')
        .insert({
          name: productName,
          description: `Produto criado automaticamente para testes`
        })
        .returning('*');
      product = newProduct;
      console.log(`✅ Produto criado com ID: ${product.id}`);
    } else {
      console.log(`✅ Produto encontrado: ${product.name} (ID: ${product.id})`);
    }

    // Criar a conta
    console.log('');
    console.log(`📝 Criando conta com domínio: ${domain}...`);
    
    const [newAccount] = await db('account')
      .insert({
        name: 'Autonomia Portal',
        social_name: 'Autonomia Portal',
        email: 'contato@autonomia.site',
        phone: null,
        product_id: product.id,
        domain: domain,
        document: null,
        instance: null
      })
      .returning('*');

    console.log('');
    console.log('✅ Conta criada com sucesso!');
    console.log(`   ID: ${newAccount.id}`);
    console.log(`   Nome: ${newAccount.name}`);
    console.log(`   Domínio: ${newAccount.domain}`);
    console.log(`   Produto ID: ${newAccount.product_id}`);
    console.log('');

    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar conta:', error);
    await db.destroy();
    process.exit(1);
  }
}

createTestAccount();

