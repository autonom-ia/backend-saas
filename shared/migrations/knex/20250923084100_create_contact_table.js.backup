exports.up = function(knex) {
  return knex.schema
    .createTable('contact', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.string('phone');
      table.jsonb('contact_data').notNullable().defaultTo(knex.raw("'{}'::jsonb"));

      table.uuid('campaign_id').references('id').inTable('campaign');

      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

      table.index(['campaign_id'], 'contact_campaign_idx');
      table.index(['phone'], 'contact_phone_idx');
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('contact');
};
