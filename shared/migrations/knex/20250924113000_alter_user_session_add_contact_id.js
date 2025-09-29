/**
 * Add nullable contact_id to user_session with FK to contact(id) and index.
 */
exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('user_session', 'contact_id');
  if (!hasCol) {
    await knex.schema.alterTable('user_session', (table) => {
      table.uuid('contact_id').references('id').inTable('contact');
    });
    // index for faster lookups by contact
    await knex.schema.alterTable('user_session', (table) => {
      table.index(['contact_id'], 'user_session_contact_idx');
    });
  }
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('user_session', 'contact_id');
  if (hasCol) {
    try {
      await knex.schema.alterTable('user_session', (table) => {
        table.dropIndex(['contact_id'], 'user_session_contact_idx');
      });
    } catch (e) {
      // ignore if index missing
    }
    await knex.schema.alterTable('user_session', (table) => {
      table.dropColumn('contact_id');
    });
  }
};
