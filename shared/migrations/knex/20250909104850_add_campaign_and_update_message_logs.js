/**
 * Migration: Add campaign table and update message_logs to reference campaign instead of template_message
 */
exports.up = function(knex) {
  return knex.schema
    // Create campaign table
    .createTable('campaign', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.text('description');
      table.uuid('template_message_id').references('id').inTable('template_message');
      table.uuid('account_id').notNullable().references('id').inTable('account');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index(['account_id'], 'campaign_account_idx');
      table.index(['template_message_id'], 'campaign_template_idx');
    })
    // Update message_logs: drop template_message_id, add campaign_id
    .then(() => knex.schema.alterTable('message_logs', (table) => {
      table.dropIndex(['template_message_id'], 'message_logs_template_idx');
    }))
    .then(() => knex.schema.alterTable('message_logs', (table) => {
      table.dropColumn('template_message_id');
    }))
    .then(() => knex.schema.alterTable('message_logs', (table) => {
      table.uuid('campaign_id').references('id').inTable('campaign');
      table.index(['campaign_id'], 'message_logs_campaign_idx');
    }));
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('message_logs', (table) => {
      table.dropIndex(['campaign_id'], 'message_logs_campaign_idx');
      table.dropColumn('campaign_id');
    })
    .then(() => knex.schema.alterTable('message_logs', (table) => {
      table.uuid('template_message_id').notNullable().references('id').inTable('template_message');
      table.index(['template_message_id'], 'message_logs_template_idx');
    }))
    .then(() => knex.schema.dropTableIfExists('campaign'));
};
