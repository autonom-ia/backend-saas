exports.up = function(knex) {
  return knex.schema.alterTable('account', function(table) {
    table.boolean('is_deleted').notNullable().defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('account', function(table) {
    table.dropColumn('is_deleted');
  });
};
