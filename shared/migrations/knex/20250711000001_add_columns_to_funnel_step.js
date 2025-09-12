/**
 * Migração para adicionar colunas à tabela conversation_funnel_step
 * - first_step: indica se é o primeiro passo do funil
 * - assign_to_team: indica se este passo atribui a conversa a um time
 */

exports.up = function(knex) {
  return knex.schema.table('conversation_funnel_step', function(table) {
    // Adiciona coluna first_step como boolean, default false
    table.boolean('first_step').defaultTo(false);
    
    // Adiciona coluna assign_to_team como boolean, default false
    table.boolean('assign_to_team').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('conversation_funnel_step', function(table) {
    // Remove as colunas adicionadas
    table.dropColumn('first_step');
    table.dropColumn('assign_to_team');
  });
};
