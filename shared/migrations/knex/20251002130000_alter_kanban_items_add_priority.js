/**
 * Migração para adicionar o campo "priority" (texto) na tabela kanban_items
 */

exports.up = function(knex) {
  return knex.schema.alterTable('kanban_items', (table) => {
    table.string('priority');
    table
      .uuid('conversation_funnel_register_id')
      .nullable()
      .references('id')
      .inTable('conversation_funnel_register')
      .onDelete('SET NULL')
      .onUpdate('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('kanban_items', (table) => {
    table.dropColumn('conversation_funnel_register_id');
    table.dropColumn('priority');
  });
};
