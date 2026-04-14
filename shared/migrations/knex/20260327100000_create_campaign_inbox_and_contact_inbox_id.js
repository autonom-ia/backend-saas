/**
 * Add campaign_inbox table and inbox_id column to contact.
 */
exports.up = async function(knex) {
  const hasCampaignInbox = await knex.schema.hasTable('campaign_inbox');

  if (!hasCampaignInbox) {
    await knex.schema.createTable('campaign_inbox', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('campaign_id').notNullable().references('id').inTable('campaign').onDelete('CASCADE');
      table.uuid('inbox_id').notNullable().references('id').inTable('inbox').onDelete('CASCADE');
      table.string('last_send_status');
      table.timestamp('last_send_at', { useTz: true });
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.unique(['campaign_id', 'inbox_id'], 'campaign_inbox_unique_campaign_inbox');
      table.index(['campaign_id'], 'campaign_inbox_campaign_idx');
      table.index(['inbox_id'], 'campaign_inbox_inbox_idx');
      table.index(['last_send_at'], 'campaign_inbox_last_send_at_idx');
    });
  }

  const hasInboxIdOnContact = await knex.schema.hasColumn('contact', 'inbox_id');
  if (!hasInboxIdOnContact) {
    await knex.schema.alterTable('contact', (table) => {
      table.uuid('inbox_id').references('id').inTable('inbox').onDelete('SET NULL');
      table.index(['inbox_id'], 'contact_inbox_idx');
    });
  }
};

exports.down = async function(knex) {
  const hasInboxIdOnContact = await knex.schema.hasColumn('contact', 'inbox_id');
  if (hasInboxIdOnContact) {
    await knex.schema.alterTable('contact', (table) => {
      table.dropIndex(['inbox_id'], 'contact_inbox_idx');
      table.dropColumn('inbox_id');
    });
  }

  const hasCampaignInbox = await knex.schema.hasTable('campaign_inbox');
  if (hasCampaignInbox) {
    await knex.schema.dropTable('campaign_inbox');
  }
};
