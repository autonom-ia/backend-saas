const registerUserService = require('../services/register-service');
const { createResponse, preflight, getOrigin } = require('../utils/cors');

const registerUser = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflight(event);
  }
  try {
    const { email, name, phone, domain } = JSON.parse(event.body);

    if (!email || !name || !phone || !domain) {
      return createResponse(400, { message: 'Email, nome, telefone e domínio são obrigatórios.' }, getOrigin(event));
    }

    const newUser = await registerUserService({ email, name, phone, domain });

    return createResponse(201, { message: 'Utilizador registado e associado à conta com sucesso.', user: newUser }, getOrigin(event));

  } catch (err) {
    console.error('Erro ao registar utilizador:', err);

    if (err.message.includes('Nenhuma conta encontrada')) {
        return createResponse(404, { message: err.message }, getOrigin(event)); // Not Found
    }

    if (err.code === '23505') { // Violação de unicidade (provavelmente email)
      return createResponse(409, { message: 'O email fornecido já está em uso.' }, getOrigin(event)); // Conflict
    }

    return createResponse(500, { message: 'Erro interno ao registar utilizador.', details: err.message }, getOrigin(event));
  }
};

module.exports = {
  handler: registerUser,
};
