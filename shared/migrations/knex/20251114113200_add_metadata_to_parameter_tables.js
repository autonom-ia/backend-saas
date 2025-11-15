/**
 * Migração para adicionar campos de metadata nas tabelas de parâmetros
 * Adiciona short_description, help_text e default_value
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('product_parameter', (table) => {
      table.string('short_description', 50);
      table.string('help_text', 255);
      table.string('default_value', 255);
    })
    .alterTable('account_parameter', (table) => {
      table.string('short_description', 50);
      table.string('help_text', 255);
      table.string('default_value', 255);
    });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('product_parameter', (table) => {
      table.dropColumn('short_description');
      table.dropColumn('help_text');
      table.dropColumn('default_value');
    })
    .alterTable('account_parameter', (table) => {
      table.dropColumn('short_description');
      table.dropColumn('help_text');
      table.dropColumn('default_value');
    });
};
