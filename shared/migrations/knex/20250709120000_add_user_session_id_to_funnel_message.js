/**
 * Migração para adicionar user_session_id à tabela user_session_conversation_funnel_step_message
 * 
 * Esta migração corrige a estrutura da tabela adicionando a coluna user_session_id que faltava
 * e criando a chave estrangeira apropriada para a tabela user_session
 */
exports.up = function(knex) {
  return knex.schema.alterTable('user_session_conversation_funnel_step_message', (table) => {
    // Adicionar coluna user_session_id
    table.uuid('user_session_id').nullable();
    
    // Adicionar chave estrangeira para user_session
    table.foreign('user_session_id')
      .references('id')
      .inTable('user_session')
      .onDelete('SET NULL')
      .onUpdate('CASCADE');
      
    // Adicionar índice para melhorar performance de consultas
    table.index(['user_session_id', 'conversation_funnel_step_message_id'], 
                'user_session_funnel_message_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('user_session_conversation_funnel_step_message', (table) => {
    // Remover índice
    table.dropIndex(['user_session_id', 'conversation_funnel_step_message_id'], 
                    'user_session_funnel_message_idx');
    
    // Remover chave estrangeira e coluna
    table.dropForeign(['user_session_id']);
    table.dropColumn('user_session_id');
  });
};
