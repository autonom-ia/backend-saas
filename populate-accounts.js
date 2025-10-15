/**
 * Script para popular a tabela de contas com dados de exemplo
 */

const knex = require('knex');
const knexConfig = require('./knexfile.js');

// Configuração do banco
const db = knex(knexConfig.development);

// Dados de exemplo para contas
const sampleAccounts = [
  {
    social_name: 'Empresa ABC Ltda',
    name: 'João Silva',
    email: 'joao@empresaabc.com.br',
    phone: '+5511999887766',
    document: '12.345.678/0001-90',
    instance: 'whatsapp-business-abc'
  },
  {
    social_name: 'Tech Solutions EIRELI',
    name: 'Maria Santos',
    email: 'maria@techsolutions.com.br',
    phone: '+5511888776655',
    document: '98.765.432/0001-10',
    instance: 'whatsapp-business-tech'
  },
  {
    social_name: 'Consultoria XYZ S/A',
    name: 'Pedro Oliveira',
    email: 'pedro@consultoriaxyz.com.br',
    phone: '+5511777665544',
    document: '11.222.333/0001-44',
    instance: 'whatsapp-business-xyz'
  },
  {
    social_name: 'Digital Marketing Pro',
    name: 'Ana Costa',
    email: 'ana@digitalmarketing.com.br',
    phone: '+5511666554433',
    document: '55.666.777/0001-88',
    instance: 'whatsapp-business-digital'
  },
  {
    social_name: 'E-commerce Plus Ltda',
    name: 'Carlos Ferreira',
    email: 'carlos@ecommerceplus.com.br',
    phone: '+5511555443322',
    document: '33.444.555/0001-22',
    instance: 'whatsapp-business-ecommerce'
  }
];

async function populateAccounts() {
  try {
    console.log('🚀 Iniciando população da tabela de contas...\n');

    // Buscar o primeiro produto disponível
    const product = await db('product').first();
    
    if (!product) {
      console.error('❌ Nenhum produto encontrado! Execute primeiro o setup-local-completo.js');
      process.exit(1);
    }

    console.log(`📦 Produto encontrado: ${product.name} (${product.id})`);

    // Verificar se já existem contas
    const existingAccounts = await db('account').count('id as count').first();
    const accountCount = parseInt(existingAccounts.count);

    if (accountCount > 0) {
      console.log(`⚠️  Já existem ${accountCount} conta(s) na tabela.`);
      console.log('🔄 Removendo contas existentes para recriar...\n');
      
      // Remover contas existentes
      await db('account').del();
    }

    // Inserir contas de exemplo
    console.log('📝 Inserindo contas de exemplo...\n');

    for (let i = 0; i < sampleAccounts.length; i++) {
      const accountData = {
        ...sampleAccounts[i],
        product_id: product.id
      };

      const [insertedAccount] = await db('account')
        .insert(accountData)
        .returning('*');

      console.log(`✅ Conta ${i + 1}: ${insertedAccount.social_name}`);
      console.log(`   📧 Email: ${insertedAccount.email}`);
      console.log(`   📱 Telefone: ${insertedAccount.phone}`);
      console.log(`   🆔 ID: ${insertedAccount.id}\n`);
    }

    // Verificar resultado final
    const finalCount = await db('account').count('id as count').first();
    console.log(`🎉 Sucesso! ${finalCount.count} contas criadas com sucesso!`);

    // Mostrar todas as contas criadas
    console.log('\n📋 Contas disponíveis para seleção:');
    console.log('=' .repeat(60));

    const allAccounts = await db('account')
      .select('id', 'social_name', 'name', 'email', 'phone')
      .orderBy('social_name');

    allAccounts.forEach((account, index) => {
      console.log(`${index + 1}. ${account.social_name}`);
      console.log(`   👤 Responsável: ${account.name}`);
      console.log(`   📧 Email: ${account.email}`);
      console.log(`   📱 Telefone: ${account.phone}`);
      console.log(`   🆔 ID: ${account.id}`);
      console.log('');
    });

    console.log('✅ Agora você pode selecionar uma conta na tela de criação de campanhas!');
    console.log('💡 Para testar a API de contas: GET http://localhost:3001/Autonomia/Saas/Accounts');

  } catch (error) {
    console.error('❌ Erro ao popular contas:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// Executar script
populateAccounts();
