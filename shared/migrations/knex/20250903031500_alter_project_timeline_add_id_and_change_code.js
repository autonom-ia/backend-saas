/**
 * Migration: alter project_timeline
 * - Add column id (uuid, default gen_random_uuid(), set as PK)
 * - Change code from uuid to string (text)
 */

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const table = 'project_timeline';

  const hasTable = await knex.schema.hasTable(table);
  if (!hasTable) return;

  // 1) Add id column with default uuid
  const hasId = await knex.schema.hasColumn(table, 'id');
  if (!hasId) {
    await knex.schema.alterTable(table, (t) => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    });
  }

  // 2) Move Primary Key from code -> id
  // Drop current PK (assumes default name `${table}_pkey`)
  await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`);
  // Set id NOT NULL and make it PK
  await knex.raw(`UPDATE ${table} SET id = gen_random_uuid() WHERE id IS NULL`);
  await knex.raw(`ALTER TABLE ${table} ALTER COLUMN id SET NOT NULL`);
  await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_pkey PRIMARY KEY (id)`);

  // 3) Change column type for code => text (string) and add unique index (optional but recommended)
  const { rows } = await knex.raw(
    `SELECT data_type FROM information_schema.columns WHERE table_name = ? AND column_name = 'code'`,
    [table]
  );
  const currentType = rows?.[0]?.data_type || '';
  if (currentType !== 'text') {
    // If code was uuid, cast to text
    await knex.raw(`ALTER TABLE ${table} ALTER COLUMN code TYPE text USING code::text`);
  }
  await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${table}_code_key ON ${table} (code)`);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const table = 'project_timeline';
  const hasTable = await knex.schema.hasTable(table);
  if (!hasTable) return;

  // Revert code to uuid and primary key on code; drop id
  // 1) Drop PK on id
  await knex.raw(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`);
  // 2) Drop unique index on code
  await knex.raw(`DROP INDEX IF EXISTS ${table}_code_key`);
  // 3) Change code back to uuid (cast where possible)
  await knex.raw(`ALTER TABLE ${table} ALTER COLUMN code TYPE uuid USING code::uuid`);
  // 4) Make code PK again
  await knex.raw(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_pkey PRIMARY KEY (code)`);
  // 5) Drop id column
  const hasId = await knex.schema.hasColumn(table, 'id');
  if (hasId) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('id');
    });
  }
};
