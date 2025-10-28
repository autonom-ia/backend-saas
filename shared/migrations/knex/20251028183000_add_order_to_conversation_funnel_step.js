/**
 * Migration para adicionar coluna order à tabela conversation_funnel_step
 */
exports.up = function(knex) {
  return knex.schema.alterTable('conversation_funnel_step', (table) => {
    table.integer('order').nullable();
  });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema.alterTable('conversation_funnel_step', (table) => {
    table.dropColumn('order');
  });
};
