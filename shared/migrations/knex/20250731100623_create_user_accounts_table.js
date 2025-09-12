// ATENÇÃO: Esta migração assume que existe uma tabela 'accounts' com uma chave primária UUID.

exports.up = function(knex) {
  return knex.schema.createTable('user_accounts', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('account_id').notNullable() // .references('id').inTable('accounts').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Para garantir que um usuário não esteja duplicado na mesma conta
    table.unique(['user_id', 'account_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('user_accounts');
};
