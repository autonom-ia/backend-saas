exports.up = function(knex) {
  return knex.schema.createTable('user_company', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('company_id').notNullable().references('id').inTable('company').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['user_id', 'company_id']);
    table.index('company_id', 'user_company_company_id_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_company');
};
