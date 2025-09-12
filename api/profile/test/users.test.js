const chalk = require('chalk');

// Variável para armazenar o ID do usuário criado
let createdUserId = null;

async function testUsers(helpers) {
  const { testGetRoute, testPostRoute, testPutRoute, testDeleteRoute } = helpers;

  console.log(chalk.cyan.bold('\n\n📋 INICIANDO SUÍTE DE TESTES PARA USERS...'));

  // 1. Criar um novo usuário
  const createUserResult = await testPostRoute(
    'Create User',
    '/users',
    'user.mock.json'
  );
  if (createUserResult && createUserResult.data.id) {
    createdUserId = createUserResult.data.id;
    console.log(chalk.blue(`   -> Usuário criado com ID: ${createdUserId}`))
  } else {
    console.log(chalk.red('   -> Falha ao criar usuário. Abortando testes de Users.'));
    return;
  }

  // 2. Listar todos os usuários
  await testGetRoute('List Users', '/users');

  // 3. Obter o usuário recém-criado
  await testGetRoute('Get User By ID', '/users/{id}', {
    path: { id: createdUserId }
  });

  // 4. Atualizar o usuário recém-criado
  await testPutRoute(
    'Update User',
    '/users/{id}',
    'user-update.mock.json',
    { id: createdUserId }
  );

  // 5. Deletar o usuário
  await testDeleteRoute('Delete User', '/users/{id}', {
    id: createdUserId
  });

  // 6. Verificar se o usuário foi deletado (espera-se um 404)
  console.log(chalk.cyan('\nVerificando se o usuário foi realmente deletado (esperando falha)...'));
  const getDeletedUserResult = await testGetRoute('Get Deleted User', '/users/{id}', {
    path: { id: createdUserId }
  });
  
  if (getDeletedUserResult === null) {
      console.log(chalk.green.bold('✅ Verificação de exclusão bem-sucedida: Usuário não encontrado como esperado.'));
  } else {
      console.log(chalk.red.bold('❌ Falha na verificação de exclusão: Usuário ainda foi encontrado.'));
  }
}

module.exports = testUsers;
