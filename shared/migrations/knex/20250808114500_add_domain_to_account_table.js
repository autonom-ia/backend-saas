exports.up = function(knex) {
  return knex.schema.alterTable('account', function(table) {
    table.string('domain');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('account', function(table) {
    table.dropColumn('domain');
  });
};
