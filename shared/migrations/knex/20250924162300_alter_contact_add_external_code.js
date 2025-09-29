/**
 * Add external_code (string) with index to contact table
 */
exports.up = async function(knex) {
  const hasCol = await knex.schema.hasColumn('contact', 'external_code');
  if (!hasCol) {
    await knex.schema.alterTable('contact', (table) => {
      table.string('external_code');
    });
    await knex.schema.alterTable('contact', (table) => {
      table.index(['external_code'], 'contact_external_code_idx');
    });
  }
};

exports.down = async function(knex) {
  const hasCol = await knex.schema.hasColumn('contact', 'external_code');
  if (hasCol) {
    try {
      await knex.schema.alterTable('contact', (table) => {
        table.dropIndex(['external_code'], 'contact_external_code_idx');
      });
    } catch (e) {
      // ignore
    }
    await knex.schema.alterTable('contact', (table) => {
      table.dropColumn('external_code');
    });
  }
};
