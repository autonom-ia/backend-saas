exports.up = function(knex) {
  return knex.schema
    .createTable('account_integration_api', (table) => {
      table.uuid('account_integration_api_id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.uuid('account_id').notNullable();
      table.foreign('account_id').references('id').inTable('account').onDelete('CASCADE');

      table.text('name').notNullable();
      table.text('slug').notNullable();
      table.text('description');
      table.text('agent_instruction').notNullable();
      table.text('base_url').notNullable();
      table.text('path_template').notNullable();
      table.text('http_method').notNullable();
      table.text('auth_type');
      table.jsonb('auth_config');
      table.jsonb('default_headers');
      table.jsonb('default_query_params');
      table.jsonb('default_body_schema');
      table.boolean('is_active').notNullable().defaultTo(true);

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['account_id', 'slug'], 'account_integration_api_account_slug_uk');
      table.check("http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')");
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('account_integration_api');
};
