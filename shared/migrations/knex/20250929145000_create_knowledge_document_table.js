exports.up = function(knex) {
  return knex.schema
    .createTable('knowledge_document', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.string('category');
      table.string('category_id');
      table.string('filename').notNullable();
      table.jsonb('document_types');
      table.string('file_extension');
      table.string('document_url');
      table.uuid('account_id').notNullable();
      table.foreign('account_id').references('id').inTable('account').onDelete('CASCADE');


      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index(['category_id'], 'knowledge_document_category_idx');
      table.index(['filename'], 'knowledge_document_filename_idx');
      table.index(['account_id'], 'knowledge_document_account_idx');
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('knowledge_document');
};
