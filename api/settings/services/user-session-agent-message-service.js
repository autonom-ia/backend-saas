const { getDbConnection } = require('../utils/database');

const createUserSessionAgentMessage = async ({ userSessionId, message }) => {
  const knex = getDbConnection();

  const [created] = await knex('user_session_agent_messages')
    .insert({
      user_session_id: userSessionId,
      message,
    })
    .returning('*');

  return created;
};

module.exports = {
  createUserSessionAgentMessage,
};
