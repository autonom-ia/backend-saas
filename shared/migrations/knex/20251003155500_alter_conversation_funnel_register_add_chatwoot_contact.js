/**
 * Migração para adicionar o campo "chatwoot_contact" em conversation_funnel_register
 */

exports.up = function(knex) {
  return knex.schema.alterTable('conversation_funnel_register', (table) => {
    table.text('chatwoot_contact').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('conversation_funnel_register', (table) => {
    table.dropColumn('chatwoot_contact');
  });
};
