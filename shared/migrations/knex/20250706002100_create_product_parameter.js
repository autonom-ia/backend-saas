/**
 * Migração para criar a tabela product_parameter
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('product_parameter', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('value').notNullable();
      table.uuid('product_id').notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Definir a chave estrangeira
      table.foreign('product_id')
        .references('id')
        .inTable('product')
        .onDelete('CASCADE');
      
      // Adicionar índice para melhorar a performance de consultas
      table.index('product_id');
    });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('product_parameter');
};
