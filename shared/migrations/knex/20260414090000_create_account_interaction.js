/**
 * Tabela de interações por conta (ex.: google-saas, logging de chamadas a APIs).
 */

exports.up = function (knex) {
  return knex.schema.createTable('account_interaction', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('account_id')
      .notNullable()
      .references('id')
      .inTable('account')
      .onDelete('CASCADE');
    table.timestamp('sent_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.jsonb('payload').notNullable();
    table.index(['account_id', 'sent_at'], 'account_interaction_account_sent_at_idx');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('account_interaction');
};
