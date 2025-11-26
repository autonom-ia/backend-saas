const { success, error } = require('../utils/response');
const { listAccessibleDomainsByUserId } = require('../services/domain-service');
const { getUserFromEvent } = require('../utils/auth-user');

module.exports.handler = async (event) => {
	try {
		const result = await getUserFromEvent(event);
		const user = result && result.user;
		if (!user || !user.id) {
			return error('Usuário não autenticado ou inválido', 401);
		}

		const domains = await listAccessibleDomainsByUserId(user.id);
		return success({ success: true, data: domains });
	} catch (err) {
		console.error('Erro ao listar domínios de contas:', err);
		const status = (err && err.statusCode) ? err.statusCode : 500;
		return error(err.message || 'Erro interno ao listar domínios', status);
	}
};
