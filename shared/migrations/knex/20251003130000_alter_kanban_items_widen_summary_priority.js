/**
 * Migração para ampliar o tamanho dos campos em kanban_items
 * - summary: text (era varchar(255))
 * - priority: text (era varchar(255))
 */

exports.up = async function(knex) {
  // Postgres: alterar tipo com USING
  await knex.schema.raw('ALTER TABLE kanban_items ALTER COLUMN summary TYPE text USING summary::text');
  // priority pode não existir em todos ambientes; proteger
  const hasPriority = await knex.schema.hasColumn('kanban_items', 'priority');
  if (hasPriority) {
    await knex.schema.raw('ALTER TABLE kanban_items ALTER COLUMN priority TYPE text USING priority::text');
  }
};

exports.down = async function(knex) {
  // Reverter para varchar(255)
  await knex.schema.raw("ALTER TABLE kanban_items ALTER COLUMN summary TYPE varchar(255)");
  const hasPriority = await knex.schema.hasColumn('kanban_items', 'priority');
  if (hasPriority) {
    await knex.schema.raw("ALTER TABLE kanban_items ALTER COLUMN priority TYPE varchar(255)");
  }
};
