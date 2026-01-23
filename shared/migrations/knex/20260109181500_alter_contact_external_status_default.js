/**
 * Set default value 'pending' for external_status column on contact table
 */

exports.up = async function up(knex) {
  const hasCol = await knex.schema.hasColumn("contact", "external_status");

  if (!hasCol) {
    return;
  }

  await knex.schema.raw(
    "ALTER TABLE contact ALTER COLUMN external_status SET DEFAULT 'pending'"
  );
};

exports.down = async function down(knex) {
  const hasCol = await knex.schema.hasColumn("contact", "external_status");

  if (!hasCol) {
    return;
  }

  await knex.schema.raw(
    "ALTER TABLE contact ALTER COLUMN external_status DROP DEFAULT"
  );
};
