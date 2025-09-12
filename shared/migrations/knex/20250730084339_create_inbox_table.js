exports.up = function(knex) {
  return knex.schema.createTable('inbox', function(table) {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('account_id').notNullable();
    table.foreign('account_id').references('id').inTable('account').onDelete('CASCADE');
    table.string('name').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('inbox');
};
