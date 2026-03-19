exports.up = async function(knex) {
  const hasDocument = await knex.schema.hasColumn('contact', 'document');

  if (!hasDocument) {
    await knex.schema.alterTable('contact', (table) => {
      table.string('document');
    });
  }

  try {
    await knex.schema.alterTable('contact', (table) => {
      table.index(['account_id', 'document'], 'contact_account_document_idx');
    });
  } catch (error) {
    // ignore if index already exists
  }
};

exports.down = async function(knex) {
  const hasDocument = await knex.schema.hasColumn('contact', 'document');

  try {
    await knex.schema.alterTable('contact', (table) => {
      table.dropIndex(['account_id', 'document'], 'contact_account_document_idx');
    });
  } catch (error) {
    // ignore if index does not exist
  }

  if (hasDocument) {
    await knex.schema.alterTable('contact', (table) => {
      table.dropColumn('document');
    });
  }
};
