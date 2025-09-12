/**
 * Adiciona a coluna is_default na tabela conversation_funnel
 */

exports.up = function (knex) {
  return knex.schema.alterTable('conversation_funnel', (table) => {
    table.boolean('is_default').notNullable().defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('conversation_funnel', (table) => {
    table.dropColumn('is_default');
  });
};
