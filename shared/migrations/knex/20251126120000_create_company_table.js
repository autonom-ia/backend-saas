exports.up = function(knex) {
  return knex.schema.createTable('company', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('social_name', 255).notNullable();
    table.string('document', 255);
    table.string('email', 255);
    table.string('phone_number', 255);
    table.string('domain', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('domain', 'company_domain_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('company');
};
