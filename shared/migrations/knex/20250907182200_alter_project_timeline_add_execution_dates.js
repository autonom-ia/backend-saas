/**
 * Migration: alter project_timeline add execution dates
 * - Adds execution_start_date (date, nullable)
 * - Adds execution_end_date (date, nullable)
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const table = 'project_timeline';
  const hasTable = await knex.schema.hasTable(table);
  if (!hasTable) return;

  const hasStart = await knex.schema.hasColumn(table, 'execution_start_date');
  const hasEnd = await knex.schema.hasColumn(table, 'execution_end_date');

  if (!hasStart || !hasEnd) {
    await knex.schema.alterTable(table, (t) => {
      if (!hasStart) t.date('execution_start_date');
      if (!hasEnd) t.date('execution_end_date');
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const table = 'project_timeline';
  const hasTable = await knex.schema.hasTable(table);
  if (!hasTable) return;

  const hasStart = await knex.schema.hasColumn(table, 'execution_start_date');
  const hasEnd = await knex.schema.hasColumn(table, 'execution_end_date');

  if (hasStart || hasEnd) {
    await knex.schema.alterTable(table, (t) => {
      if (hasStart) t.dropColumn('execution_start_date');
      if (hasEnd) t.dropColumn('execution_end_date');
    });
  }
};
