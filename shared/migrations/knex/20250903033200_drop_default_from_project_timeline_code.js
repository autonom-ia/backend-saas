/**
 * Migration: remove default from project_timeline.code
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE project_timeline ALTER COLUMN code DROP DEFAULT');
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  // Reapply a safe default compatible with current type (text)
  await knex.raw("ALTER TABLE project_timeline ALTER COLUMN code SET DEFAULT gen_random_uuid()::text");
};
