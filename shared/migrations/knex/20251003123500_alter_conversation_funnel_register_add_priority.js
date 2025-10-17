/**
 * Migração para adicionar a coluna "priority" (texto) na tabela conversation_funnel_register
 */

exports.up = function(knex) {
  return knex.schema.alterTable('conversation_funnel_register', (table) => {
    table.string('priority');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('conversation_funnel_register', (table) => {
    table.dropColumn('priority');
  });
};
