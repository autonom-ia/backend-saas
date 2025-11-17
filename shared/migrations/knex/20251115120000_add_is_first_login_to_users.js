exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.boolean('is_first_login').defaultTo(true).notNullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('is_first_login');
  });
};
