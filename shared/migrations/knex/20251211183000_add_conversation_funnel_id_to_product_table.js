/**
 * Adiciona a coluna conversation_funnel_id na tabela product
 * e cria a foreign key para conversation_funnel.
 */

exports.up = function (knex) {
  return knex.schema.alterTable('product', (table) => {
    table
      .uuid('conversation_funnel_id')
      .nullable()
      .references('id')
      .inTable('conversation_funnel')
      .onDelete('SET NULL')
      .onUpdate('CASCADE');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('product', (table) => {
    table.dropColumn('conversation_funnel_id');
  });
};
