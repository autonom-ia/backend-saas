exports.up = async function up(knex) {
  const tableName = 'account';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, 'is_deleted_account');
  if (hasColumn) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.boolean('is_deleted_account').notNullable().defaultTo(false);
  });
};

exports.down = async function down(knex) {
  const tableName = 'account';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, 'is_deleted_account');
  if (!hasColumn) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('is_deleted_account');
  });
};
