exports.up = function(knex) {
  return knex.schema
    .createTable('user_group', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.string('name').notNullable();

      table.uuid('user_session_id').notNullable();
      table
        .foreign('user_session_id')
        .references('id')
        .inTable('user_session')
        .onDelete('CASCADE');

      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index(['user_session_id'], 'user_group_user_session_idx');
      table.index(['name'], 'user_group_name_idx');
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_group');
};
