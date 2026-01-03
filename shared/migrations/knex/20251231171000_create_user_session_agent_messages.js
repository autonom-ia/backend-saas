/**
 * Migração para criar a tabela user_session_agent_messages
 * Armazena o log de mensagens enviadas pelo agente de IA para o usuário
 */

exports.up = function(knex) {
  return knex.schema.createTable('user_session_agent_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_session_id').notNullable().references('id').inTable('user_session').onDelete('CASCADE');
    table.timestamp('sent_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text('message').notNullable();

    table.index('user_session_id', 'user_session_agent_messages_user_session_idx');
    table.index('sent_at', 'user_session_agent_messages_sent_at_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_session_agent_messages');
};
