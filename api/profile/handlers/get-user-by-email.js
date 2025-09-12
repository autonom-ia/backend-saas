const { getDbConnection } = require('../utils/database');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

module.exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  console.log('Recebendo requisição teste sem authorizer:', JSON.stringify(event));
  
  try {
    const origin = getOrigin(event);
    // Extrair o email dos queryStringParameters
    const { email } = event.queryStringParameters || {};

    console.log('Email recebido:', email);

    if (!email) {
      return createResponse(400, { message: 'Email é obrigatório', debug: true }, origin);
    }

    // Verificar conexão com banco de dados
    console.log('Tentando conectar ao banco de dados...');
    try {
      // Conectar ao banco de dados
      const knex = getDbConnection();
      console.log('Conexão com banco de dados estabelecida');
      
      // Log da query que será executada
      console.log(`Executando query para buscar usuário com email: ${email}`);
      
      // Buscar o usuário pelo email
      const user = await knex('users')
        .where({ email })
        .select('id', 'name', 'email', 'phone', 'created_at')
        .first();

      console.log('Resultado da query:', user ? 'Usuário encontrado' : 'Usuário não encontrado');

      if (!user) {
        return createResponse(404, { message: 'Usuário não encontrado', email }, origin);
      }

      // Calcular flag de admin consultando perfis de acesso do usuário
      const ADMIN_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';
      const userProfiles = await knex('user_access_profiles')
        .where({ user_id: user.id })
        .pluck('access_profile_id');
      const isAdmin = Array.isArray(userProfiles) && userProfiles.includes(ADMIN_PROFILE_ID);

      // Retornar os dados do usuário com headers CORS (inclui isAdmin)
      return createResponse(200, { user: { ...user, isAdmin } }, origin);
    } catch (dbError) {
      console.error('Erro específico na conexão com o banco de dados:', dbError);
      return createResponse(500, { 
        message: 'Erro na conexão com o banco de dados', 
        error: dbError.message,
        stack: dbError.stack
      }, origin);
    }
  } catch (error) {
    console.error('Erro ao buscar usuário por email:', error);
    
    return createResponse(500, { 
      message: 'Erro ao processar solicitação',
      error: error.message,
      stack: error.stack
    }, getOrigin(event));
  }
};
