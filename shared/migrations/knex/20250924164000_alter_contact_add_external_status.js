/**
 * Add external_status (string) to contact table
 */
exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('contact', 'external_status');
  if (!hasCol) {
    await knex.schema.alterTable('contact', (table) => {
      table.string('external_status');
    });
  }
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('contact', 'external_status');
  if (hasCol) {
    await knex.schema.alterTable('contact', (table) => {
      table.dropColumn('external_status');
    });
  }
};
