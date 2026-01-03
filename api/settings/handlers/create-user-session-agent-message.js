const { createUserSessionAgentMessage } = require('../services/user-session-agent-message-service');
const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    let body;

    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return error({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { userSessionId, message } = body;

    if (!userSessionId) {
      return error({ success: false, message: 'userSessionId é obrigatório' }, 400);
    }

    if (!message) {
      return error({ success: false, message: 'message é obrigatório' }, 400);
    }

    const created = await createUserSessionAgentMessage({ userSessionId, message });

    return success({ success: true, data: created }, 201);
  } catch (err) {
    console.error('[settings:create-user-session-agent-message] Erro ao registrar mensagem do agente:', err);
    return error({ success: false, message: 'Erro ao registrar mensagem do agente', error: err.message }, 500);
  }
};
