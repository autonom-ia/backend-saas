/**
 * Migração para adicionar a coluna "kanban_code" na tabela conversation_funnel_step
 */

exports.up = function(knex) {
  return knex.schema.alterTable('conversation_funnel_step', (table) => {
    table.string('kanban_code');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('conversation_funnel_step', (table) => {
    table.dropColumn('kanban_code');
  });
};
