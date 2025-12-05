exports.up = function(knex) {
  return knex.schema.alterTable('user_session_integration_api_values', (table) => {
    table.renameColumn('user_session_integration_api_values_id', 'id');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('user_session_integration_api_values', (table) => {
    table.renameColumn('id', 'user_session_integration_api_values_id');
  });
};
