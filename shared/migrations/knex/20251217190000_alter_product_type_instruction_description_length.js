exports.up = function (knex) {
  // Aumenta o tamanho do campo description para evitar erro de varchar(255)
  // Em PostgreSQL, usar text remove a limitação prática de tamanho.
  return knex.schema.alterTable('product_type_instruction', (table) => {
    table.text('description').notNullable().alter();
  });
};

exports.down = function (knex) {
  // Reverte para o tipo original varchar(255)
  return knex.schema.alterTable('product_type_instruction', (table) => {
    table.string('description', 255).notNullable().alter();
  });
};
