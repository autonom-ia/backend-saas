/**
 * Migração para adicionar o campo agent_instruction nas tabelas de funil
 * 
 * Este campo armazenará instruções específicas para agentes que processarão
 * os funis de conversação e suas etapas
 */
exports.up = function(knex) {
  return knex.schema
    // Adicionar campo agent_instruction na tabela conversation_funnel
    .alterTable('conversation_funnel', (table) => {
      table.text('agent_instruction').nullable();
    })
    
    // Adicionar campo agent_instruction na tabela conversation_funnel_step
    .alterTable('conversation_funnel_step', (table) => {
      table.text('agent_instruction').nullable();
    });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema
    // Remover campo agent_instruction da tabela conversation_funnel_step
    .alterTable('conversation_funnel_step', (table) => {
      table.dropColumn('agent_instruction');
    })
    
    // Remover campo agent_instruction da tabela conversation_funnel
    .alterTable('conversation_funnel', (table) => {
      table.dropColumn('agent_instruction');
    });
};
