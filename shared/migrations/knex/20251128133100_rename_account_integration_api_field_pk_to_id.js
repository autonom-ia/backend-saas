exports.up = function(knex) {
  return knex.schema.alterTable('account_integration_api_field', (table) => {
    table.renameColumn('account_integration_api_field_id', 'id');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('account_integration_api_field', (table) => {
    table.renameColumn('id', 'account_integration_api_field_id');
  });
};
