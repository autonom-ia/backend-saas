/**
 * Create contact table for campaign contacts
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('contact', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('phone').notNullable();
      table.jsonb('contact_data').defaultTo('{}');
      table.uuid('campaign_id').notNullable().references('id').inTable('campaign');
      table.uuid('account_id').notNullable().references('id').inTable('account');
      table.string('external_code');
      table.string('external_status').defaultTo('pending');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      // Indexes
      table.index(['campaign_id'], 'contact_campaign_idx');
      table.index(['account_id'], 'contact_account_idx');
      table.index(['phone'], 'contact_phone_idx');
      table.index(['external_status'], 'contact_status_idx');
      
      // Unique constraint to prevent duplicate phones in same campaign
      table.unique(['campaign_id', 'phone'], 'contact_campaign_phone_uk');
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('contact');
};
