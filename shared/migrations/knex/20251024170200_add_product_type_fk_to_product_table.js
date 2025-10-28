exports.up = async function up(knex) {
  const tableName = 'product';
  const columnName = 'product_type_id';

  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (hasColumn) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.uuid(columnName).nullable().references('id').inTable('product_type');
    table.index(columnName, 'product_product_type_id_idx');
  });
};
exports.down = async function down(knex) {
  const tableName = 'product';
  const columnName = 'product_type_id';

  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.dropIndex(columnName, 'product_product_type_id_idx');
    table.dropColumn(columnName);
  });
};
