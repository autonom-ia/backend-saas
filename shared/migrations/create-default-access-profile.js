/**
 * Script para criar o perfil de acesso padrão no banco de dados
 * 
 * Uso:
 *   node shared/migrations/create-default-access-profile.js
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

// ID do perfil padrão usado no código
const DEFAULT_PROFILE_ID = 'e8cbb607-4a3a-44c6-8669-a5c6d2bd5e17';

async function createDefaultAccessProfile() {
  try {
    console.log('====================================');
    console.log('Criando perfil de acesso padrão');
    console.log('====================================');
    console.log('');

    // Verificar se já existe o perfil com esse ID
    let profile = await db('access_profiles').where({ id: DEFAULT_PROFILE_ID }).first();

    if (profile) {
      console.log('✅ Perfil padrão já existe:');
      console.log(`   ID: ${profile.id}`);
      console.log(`   Nome: ${profile.name}`);
      console.log(`   Admin: ${profile.admin}`);
      console.log(`   Descrição: ${profile.description || 'N/A'}`);
      await db.destroy();
      process.exit(0);
    }

    // Verificar se existe algum perfil com nome "Usuário" ou "Padrão"
    const existingProfile = await db('access_profiles')
      .whereIn('name', ['Usuário', 'Padrão', 'Default', 'User'])
      .first();

    if (existingProfile) {
      console.log(`⚠️  Existe um perfil similar: ${existingProfile.name} (ID: ${existingProfile.id})`);
      console.log('💡 Você pode atualizar o código para usar este ID ou criar um novo perfil.');
      console.log('');
      console.log('Para usar o perfil existente, atualize o código em:');
      console.log('  api/profile/services/register-service.js');
      console.log(`  Altere o access_profile_id para: ${existingProfile.id}`);
      await db.destroy();
      process.exit(0);
    }

    // Criar o perfil padrão com o ID específico
    console.log('📝 Criando perfil de acesso padrão...');
    
    const [newProfile] = await db('access_profiles')
      .insert({
        id: DEFAULT_PROFILE_ID,
        name: 'Usuário',
        description: 'Perfil de acesso padrão para usuários',
        admin: false
      })
      .returning('*');

    console.log('');
    console.log('✅ Perfil criado com sucesso!');
    console.log(`   ID: ${newProfile.id}`);
    console.log(`   Nome: ${newProfile.name}`);
    console.log(`   Admin: ${newProfile.admin}`);
    console.log(`   Descrição: ${newProfile.description}`);
    console.log('');

    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar perfil:', error);
    await db.destroy();
    process.exit(1);
  }
}

createDefaultAccessProfile();

