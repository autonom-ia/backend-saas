/**
 * Migração para alterar o campo value da tabela account_parameter para TEXT (sem limitação de tamanho)
 */
exports.up = function(knex) {
  return knex.schema.alterTable('account_parameter', (table) => {
    // Altera o tipo da coluna 'value' de VARCHAR para TEXT
    table.text('value').notNullable().alter();
  });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema.alterTable('account_parameter', (table) => {
    // Reverte a alteração, voltando a coluna 'value' para VARCHAR(255)
    table.string('value').notNullable().alter();
  });
};
