/**
 * Alter contact table to add account_id (FK, index) and ensure JSONB column is contact_data.
 * Attempts to enforce NOT NULL on account_id if table has no rows.
 */
exports.up = async function(knex) {
  // 1) Ensure JSONB column is named contact_data
  const hasDataCol = await knex.schema.hasColumn('contact', 'data');
  const hasContactDataCol = await knex.schema.hasColumn('contact', 'contact_data');
  if (hasDataCol && !hasContactDataCol) {
    await knex.schema.alterTable('contact', (table) => {
      table.renameColumn('data', 'contact_data');
    });
  } else if (!hasContactDataCol) {
    // If neither exists, create contact_data with default
    await knex.schema.alterTable('contact', (table) => {
      table.jsonb('contact_data').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    });
  }

  // 2) Add account_id column (initially nullable), FK and index if not present
  const hasAccountId = await knex.schema.hasColumn('contact', 'account_id');
  if (!hasAccountId) {
    await knex.schema.alterTable('contact', (table) => {
      table.uuid('account_id').references('id').inTable('account');
    });

    // Add index
    await knex.schema.alterTable('contact', (table) => {
      table.index(['account_id'], 'contact_account_idx');
    });

    // Try to enforce NOT NULL if table is empty (safe)
    const [{ count }] = await knex('contact').count({ count: '*' });
    const total = Number(count || 0);
    if (total === 0) {
      await knex.raw('ALTER TABLE contact ALTER COLUMN account_id SET NOT NULL');
    } else {
      console.warn('[migration] contact.account_id left NULLABLE because table has', total, 'rows. Backfill required before enforcing NOT NULL.');
    }
  }
};

exports.down = async function(knex) {
  // Reverse NOT NULL if set (safe to run even if already nullable)
  const hasAccountId = await knex.schema.hasColumn('contact', 'account_id');
  if (hasAccountId) {
    try {
      await knex.raw('ALTER TABLE contact ALTER COLUMN account_id DROP NOT NULL');
    } catch (e) {
      // ignore
    }
    // Drop index if exists and then column
    try {
      await knex.schema.alterTable('contact', (table) => {
        table.dropIndex(['account_id'], 'contact_account_idx');
      });
    } catch (e) {
      // ignore
    }
    await knex.schema.alterTable('contact', (table) => {
      table.dropColumn('account_id');
    });
  }

  // Rename contact_data back to data if present (best-effort)
  const hasContactDataCol = await knex.schema.hasColumn('contact', 'contact_data');
  const hasDataCol = await knex.schema.hasColumn('contact', 'data');
  if (hasContactDataCol && !hasDataCol) {
    await knex.schema.alterTable('contact', (table) => {
      table.renameColumn('contact_data', 'data');
    });
  }
};
