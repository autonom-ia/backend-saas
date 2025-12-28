exports.up = function (knex) {
  return knex.schema.dropTableIfExists('account_integration_api_field');
};

exports.down = function (knex) {
  return knex.schema.createTable('account_integration_api_field', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('account_integration_api_id').notNullable();
    table
      .foreign('account_integration_api_id')
      .references('account_integration_api_id')
      .inTable('account_integration_api')
      .onDelete('CASCADE');

    table.text('api_field_key').notNullable();
    table.text('user_label').notNullable();
    table.text('user_description');
    table.text('data_type').notNullable();
    table.boolean('required').notNullable();
    table.integer('sort_order').notNullable();

    // Campo incluído pela migration 20251128140000_add_auto_fill_document_type_to_account_integration_api_field
    table.text('auto_fill_document_type');

    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(
      ['account_integration_api_id', 'api_field_key'],
      'account_integration_api_field_api_key_uk'
    );
    table.check(
      "data_type IN ('string', 'number', 'date', 'boolean', 'enum', 'object')"
    );
  });
};
