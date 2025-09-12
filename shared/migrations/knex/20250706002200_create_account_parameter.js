/**
 * Migração para criar a tabela account_parameter
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('account_parameter', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('value').notNullable();
      table.uuid('account_id').notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Definir a chave estrangeira
      table.foreign('account_id')
        .references('id')
        .inTable('account')
        .onDelete('CASCADE');
      
      // Adicionar índice para melhorar a performance de consultas
      table.index('account_id');
    });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('account_parameter');
};
