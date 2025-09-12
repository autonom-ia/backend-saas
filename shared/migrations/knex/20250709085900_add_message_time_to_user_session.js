/**
 * Migração para adicionar o campo message_time (INTEGER) à tabela user_session
 * 
 * Este campo armazena o tempo da mensagem em segundos
 */
exports.up = function(knex) {
  return knex.schema.table('user_session', (table) => {
    table.integer('message_time').nullable().comment('Tempo da mensagem em segundos');
  });
};

exports.down = function(knex) {
  return knex.schema.table('user_session', (table) => {
    table.dropColumn('message_time');
  });
};
