/**
 * Add updated_at timestamp to user_session with default now()
 */
exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('user_session', 'updated_at');
  if (!hasCol) {
    await knex.schema.alterTable('user_session', (table) => {
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('user_session', 'updated_at');
  if (hasCol) {
    await knex.schema.alterTable('user_session', (table) => {
      table.dropColumn('updated_at');
    });
  }
};
