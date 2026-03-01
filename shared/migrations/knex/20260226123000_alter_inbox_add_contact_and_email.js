exports.up = function (knex) {
  return knex.schema.alterTable('inbox', function (table) {
    table.string('notification_email').nullable();
    table.string('contact_name').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('inbox', function (table) {
    table.dropColumn('notification_email');
    table.dropColumn('contact_name');
  });
};
