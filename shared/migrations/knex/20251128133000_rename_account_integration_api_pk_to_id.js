exports.up = function(knex) {
  return knex.schema.alterTable('account_integration_api', (table) => {
    table.renameColumn('account_integration_api_id', 'id');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('account_integration_api', (table) => {
    table.renameColumn('id', 'account_integration_api_id');
  });
};
