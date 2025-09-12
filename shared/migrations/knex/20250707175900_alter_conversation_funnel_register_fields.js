/**
 * Migração para alterar os campos array para texto simples na tabela conversation_funnel_register
 */
exports.up = function(knex) {
  return Promise.all([
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN declared_interests TYPE TEXT'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN mentioned_products TYPE TEXT'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN points_attention_objections TYPE TEXT'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN last_timestamptz SET DEFAULT now()'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN last_timestamptz SET NOT NULL')
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN declared_interests TYPE TEXT[]'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN mentioned_products TYPE TEXT[]'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN points_attention_objections TYPE TEXT[]'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN last_timestamptz DROP DEFAULT'),
    knex.raw('ALTER TABLE conversation_funnel_register ALTER COLUMN last_timestamptz DROP NOT NULL')
  ]);
};
