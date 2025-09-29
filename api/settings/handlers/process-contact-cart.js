/**
 * Handler para processar contato e iniciar configuração de carrinho
 */
const { processContactCart } = require('../services/process-contact-cart-service');
const { success, error } = require('../utils/response');
const { closeDbConnection } = require('../utils/database');

module.exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');

    const result = await processContactCart(body);

    if (result.type === 'finalLink') {
      return success({ message: 'Checkout pronto', data: { finalLink: result.finalLink } });
    }

    return success({
      message: 'Estamos realizando fazendo a configuração do seu carrinho, em instantes retornaremos com o link para o checkout',
      data: null,
    });
  } catch (err) {
    console.error('Erro ao processar o carrinho do contato:', err);
    return error(err.message || 'Erro interno ao processar solicitação');
  } finally {
    await closeDbConnection();
  }
};
