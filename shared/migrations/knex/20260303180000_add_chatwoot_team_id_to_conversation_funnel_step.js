/**
 * Adiciona a coluna chatwoot_team_id na tabela conversation_funnel_step
 */

exports.up = function up(knex) {
  return knex.schema.table('conversation_funnel_step', (table) => {
    table.integer('chatwoot_team_id').nullable();
  });
};

exports.down = function down(knex) {
  return knex.schema.table('conversation_funnel_step', (table) => {
    table.dropColumn('chatwoot_team_id');
  });
};
