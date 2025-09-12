/**
 * Create tables for lead messaging: template_message, message_logs, chat_memory
 */
exports.up = function(knex) {
  return knex.schema
    // Table: template_message
    .createTable('template_message', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('account_id').notNullable().references('id').inTable('account');
      table.string('name').notNullable();
      table.text('message_text').notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.unique(['account_id', 'name'], 'template_message_account_name_uk');
      table.index(['account_id'], 'template_message_account_idx');
    })

    // Table: message_logs
    .createTable('message_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('template_message_id').notNullable().references('id').inTable('template_message');
      table.uuid('user_session_id').references('id').inTable('user_session');
      table.text('phone_number');
      table.boolean('success').notNullable().defaultTo(false);
      table.text('error');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index(['template_message_id'], 'message_logs_template_idx');
      table.index(['user_session_id'], 'message_logs_user_session_idx');
      table.index(['phone_number'], 'message_logs_phone_idx');
    })

    // Table: chat_memory
    .createTable('chat_memory', (table) => {
      table.increments('id').primary(); // serial primary key
      table.string('session_id', 255).notNullable();
      table.jsonb('message').notNullable();
      table.timestamp('timestamptz', { useTz: true }).defaultTo(knex.fn.now());

      table.index(['session_id'], 'chat_memory_session_idx');
      // optional: GIN index on jsonb message for querying, uncomment if desired
      // table.index(['message'], 'chat_memory_message_gin_idx', 'gin');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_memory')
    .dropTableIfExists('message_logs')
    .dropTableIfExists('template_message');
};
