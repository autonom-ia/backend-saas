exports.up = function(knex) {
  return knex.schema.createTable('product_type_instruction', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_type_id').notNullable().references('id').inTable('product_type');
    table.string('code', 100).notNullable();
    table.string('description', 255).notNullable();
    table.text('instruction').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index(['product_type_id', 'code'], 'product_type_instruction_type_code_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('product_type_instruction');
};
