exports.up = function(knex) {
  return knex.schema.alterTable('user_accounts', function(table) {
    // Remove a constraint de unicidade composta em (user_id, account_id)
    table.dropUnique(['user_id', 'account_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('user_accounts', function(table) {
    // Restaura a constraint de unicidade composta em (user_id, account_id)
    table.unique(['user_id', 'account_id']);
  });
};
