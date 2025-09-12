/**
 * Migração para renomear a coluna creation_at para created_at na tabela user_session
 */
exports.up = function(knex) {
  return knex.schema.alterTable('user_session', (table) => {
    // Renomear a coluna creation_at para created_at
    table.renameColumn('creation_at', 'created_at');
  });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema.alterTable('user_session', (table) => {
    // Reverter a alteração, voltando ao nome original
    table.renameColumn('created_at', 'creation_at');
  });
};
