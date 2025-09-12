/**
 * Migração para adicionar o campo 'enable_auto_assignment' à tabela 'conversation_funnel'.
 */
exports.up = function(knex) {
  return knex.schema.table('conversation_funnel', function(table) {
    // Adiciona a coluna booleana para controlar a atribuição automática, com valor padrão 'false'
    table.boolean('enable_auto_assignment').notNullable().defaultTo(false);
  });
};

/**
 * Reverte a migração, removendo a coluna.
 */
exports.down = function(knex) {
  return knex.schema.table('conversation_funnel', function(table) {
    table.dropColumn('enable_auto_assignment');
  });
};
