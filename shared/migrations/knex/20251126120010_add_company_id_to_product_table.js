exports.up = function(knex) {
  return knex.schema.alterTable('product', function(table) {
    table.uuid('company_id').nullable().references('id').inTable('company');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('product', function(table) {
    table.dropColumn('company_id');
  });
};
