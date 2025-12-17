exports.up = function(knex) {
  return knex.schema.alterTable('account_integration_api_field', (table) => {
    // Campo para indicar para qual tipo/identificador de documento
    // este campo pode ser preenchido automaticamente
    table.text('auto_fill_document_type');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('account_integration_api_field', (table) => {
    table.dropColumn('auto_fill_document_type');
  });
};
