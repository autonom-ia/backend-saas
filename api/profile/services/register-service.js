
const { getDbConnection } = require('../utils/database');

const registerUser = async ({ email, name, phone, domain }) => {
  const knex = getDbConnection();
  let accountId;

  // 1. Encontrar a conta pelo domínio
  try {
    const account = await knex('account').where({ domain }).first();
    if (!account) {
      throw new Error(`Nenhuma conta encontrada para o domínio: ${domain}`);
    }
    accountId = account.id;
  } catch (err) {
    console.error('Erro ao procurar a conta:', err);
    throw new Error('Falha ao verificar o domínio da conta.');
  }

  // 2. Criar o utilizador e a associação numa transação 
  // Incluido para o deploy
    return knex.transaction(async (transaction) => {
    // Inserir na tabela 'user'
        const [newUser] = await transaction('users')
      .insert({
        name,
        email,
        phone,
      })
      .returning('*');

    // Associar na tabela 'user_account'
        await transaction('user_accounts').insert({
      user_id: newUser.id,
      account_id: accountId,
    });

    // Adicionar perfil de acesso padrão
        await transaction('user_access_profiles').insert({
      user_id: newUser.id,
      access_profile_id: 'e8cbb607-4a3a-44c6-8669-a5c6d2bd5e17',
    });

    return newUser;
  });
};

module.exports = registerUser;
