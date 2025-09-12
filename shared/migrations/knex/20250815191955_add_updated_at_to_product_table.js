/**
 * Migração: adicionar coluna updated_at à tabela product
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const tableName = 'product';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, 'updated_at');
  if (hasColumn) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const tableName = 'product';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, 'updated_at');
  if (!hasColumn) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('updated_at');
  });
};
