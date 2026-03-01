const { listAccountsWithFunnel } = require('../services/account-list-with-funnel-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

module.exports.handler = async (event) => {
  try {
    console.log('Evento recebido (ListAccountsWithFunnel):', JSON.stringify(event));

    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit, 10) || 50;
    const offset = parseInt(queryParams.offset, 10) || 0;

    if (limit > 100) {
      return error('Limite máximo permitido é 100 registros', 400);
    }

    console.log(`Listando contas com funil com limit: ${limit}, offset: ${offset}`);

    const data = await listAccountsWithFunnel(limit, offset);

    return success({
      message: 'Contas com funil listadas com sucesso',
      data,
      pagination: {
        limit,
        offset,
        count: data.length,
      },
    });
  } catch (err) {
    console.error('Erro ao processar a requisição ListAccountsWithFunnel:', err);
    return error(err.message || 'Erro interno ao processar a requisição');
  } finally {
    await closeDbConnection();
  }
};
