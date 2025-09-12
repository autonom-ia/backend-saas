const { getDbConnection } = require('../utils/database');

async function createChatMemory({ session_id, message }) {
  const knex = getDbConnection();
  const [row] = await knex('chat_memory')
    .insert({ session_id, message })
    .returning(['id', 'session_id', 'message', 'timestamptz']);
  return row;
}

module.exports = {
  createChatMemory,
};
