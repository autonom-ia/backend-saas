/**
 * Migration: create project_timeline table
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const tableName = 'project_timeline';

  const exists = await knex.schema.hasTable(tableName);
  if (exists) return;

  await knex.schema.createTable(tableName, (table) => {
    // Primary key as UUID with default, named 'code'
    table.uuid('code').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Relationship to project
    table.uuid('project_id').notNullable();
    table
      .foreign('project_id')
      .references('id')
      .inTable('project')
      .onDelete('CASCADE');

    // Columns from schedule (English snake_case)
    table.string('phase');
    table.string('task');
    table.string('responsible');
    table.string('supporters');
    table.date('start_date');
    table.date('due_date');
    table.string('status');
    table.text('dependencies');
    table.text('acceptance_criteria');
    table.string('evidence_link');
    table.boolean('milestone');
    table.text('notes');

    // Timestamps
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index('status');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const tableName = 'project_timeline';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;
  await knex.schema.dropTableIfExists(tableName);
};

