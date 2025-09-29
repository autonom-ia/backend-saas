/**
 * Add inbox_id and conversation_id (integers) to user_session
 */
exports.up = async function(knex) {
  const hasInbox = await knex.schema.hasColumn('user_session', 'inbox_id');
  const hasConv = await knex.schema.hasColumn('user_session', 'conversation_id');
  if (!hasInbox || !hasConv) {
    await knex.schema.alterTable('user_session', (table) => {
      if (!hasInbox) table.integer('inbox_id');
      if (!hasConv) table.integer('conversation_id');
    });
    // Optional: indexes for quick filters
    await knex.schema.alterTable('user_session', (table) => {
      if (!hasInbox) table.index(['inbox_id'], 'user_session_inbox_idx');
      if (!hasConv) table.index(['conversation_id'], 'user_session_conversation_idx');
    });
  }
};

exports.down = async function(knex) {
  const hasInbox = await knex.schema.hasColumn('user_session', 'inbox_id');
  const hasConv = await knex.schema.hasColumn('user_session', 'conversation_id');
  if (hasInbox || hasConv) {
    await knex.schema.alterTable('user_session', (table) => {
      if (hasInbox) table.dropIndex(['inbox_id'], 'user_session_inbox_idx');
      if (hasConv) table.dropIndex(['conversation_id'], 'user_session_conversation_idx');
    });
    await knex.schema.alterTable('user_session', (table) => {
      if (hasInbox) table.dropColumn('inbox_id');
      if (hasConv) table.dropColumn('conversation_id');
    });
  }
};
