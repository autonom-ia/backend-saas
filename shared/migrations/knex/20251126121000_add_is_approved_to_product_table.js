exports.up = function(knex) {
  return knex.schema.alterTable('product', function(table) {
    // Indica se o produto está aprovado para contratação/uso geral
    table.boolean('is_approved').notNullable().defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('product', function(table) {
    table.dropColumn('is_approved');
  });
};
