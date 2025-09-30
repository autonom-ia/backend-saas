exports.up = function(knex) {
  return knex.schema.alterTable('knowledge_document', function(table) {
    table.boolean('deleted').notNullable().defaultTo(false);
    table.index(['deleted'], 'knowledge_document_deleted_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('knowledge_document', function(table) {
    table.dropIndex(['deleted'], 'knowledge_document_deleted_idx');
    table.dropColumn('deleted');
  });
};
