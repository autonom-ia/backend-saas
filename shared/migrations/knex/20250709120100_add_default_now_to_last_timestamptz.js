/**
 * Migração para adicionar valor padrão NOW() ao campo last_timestamptz na tabela conversation_funnel_register
 * 
 * Esta migração ajusta o campo last_timestamptz para que sempre tenha um valor padrão
 * quando um novo registro é inserido sem especificar esse campo
 */
exports.up = function(knex) {
  return knex.schema.alterTable('conversation_funnel_register', (table) => {
    // Modificar a coluna last_timestamptz para ter DEFAULT NOW()
    table.timestamp('last_timestamptz', { useTz: true })
      .defaultTo(knex.fn.now())
      .alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('conversation_funnel_register', (table) => {
    // Reverter a modificação removendo o valor padrão
    table.timestamp('last_timestamptz', { useTz: true })
      .defaultTo(null)
      .alter();
  });
};
