exports.up = function(knex) {
  return knex.schema
    .createTable('user_session_integration_api_values', (table) => {
      table.uuid('user_session_integration_api_values_id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.uuid('user_session_id').notNullable();
      table.foreign('user_session_id').references('id').inTable('user_session').onDelete('CASCADE');

      table.uuid('account_integration_api_id').notNullable();
      table.foreign('account_integration_api_id')
        .references('account_integration_api_id')
        .inTable('account_integration_api')
        .onDelete('CASCADE');

      table.jsonb('values_json').notNullable().defaultTo('{}');
      table.text('status').notNullable();
      table.text('last_error');

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['user_session_id', 'account_integration_api_id'], 'user_session_integration_api_values_uk');
      table.check("status IN ('collecting', 'ready', 'sent', 'error')");
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_session_integration_api_values');
};
