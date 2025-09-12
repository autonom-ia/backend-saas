/**
 * Migration: create project table with FK to product
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = function up(knex) {
  return knex.schema.createTable('project', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('name').notNullable();
    table.text('description');
    table.date('start_date');
    table.date('end_date');

    // Relationship to product
    table.uuid('product_id').notNullable();
    table
      .foreign('product_id')
      .references('id')
      .inTable('product')
      .onDelete('CASCADE');

    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('product_id');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('project');
};
