/**
 * Migração para criar a tabela product_parameters_standard
 * Define parâmetros padrão que serão usados no onboarding e configuração de produtos
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('product_parameters_standard', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 255).notNullable();
      table.boolean('visible_onboarding').defaultTo(true);
      table.string('short_description', 50);
      table.string('help_text', 255);
      table.string('default_value', 255);
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Adicionar índice para melhorar a performance de consultas
      table.index('visible_onboarding');
    });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('product_parameters_standard');
};
