/**
 * Migração: adicionar coluna subdomain à tabela product
 * 
 * Esta coluna é usada para filtrar produtos por subdomain nas rotas públicas
 * do financial-service (ex: /products?companyId=xxx&subdomain=viagem)
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const tableName = 'product';
  const columnName = 'subdomain';
  
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) {
    console.log(`Tabela ${tableName} não existe. Pulando migração.`);
    return;
  }

  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (hasColumn) {
    console.log(`Coluna ${columnName} já existe na tabela ${tableName}. Pulando migração.`);
    return;
  }

  await knex.schema.alterTable(tableName, (table) => {
    table.string(columnName, 255).nullable().comment('Subdomain do produto (ex: viagem, rc-medico)');
    table.index(columnName, 'product_subdomain_idx');
  });
  
  console.log(`Coluna ${columnName} adicionada à tabela ${tableName} com sucesso.`);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const tableName = 'product';
  const columnName = 'subdomain';
  
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.dropIndex(columnName, 'product_subdomain_idx');
    table.dropColumn(columnName);
  });
  
  console.log(`Coluna ${columnName} removida da tabela ${tableName} com sucesso.`);
};
