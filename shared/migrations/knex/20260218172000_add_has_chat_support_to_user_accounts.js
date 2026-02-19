exports.up = function (knex) {
  return knex.schema.alterTable('user_accounts', function (table) {
    table.boolean('has_chat_support').notNullable().defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('user_accounts', function (table) {
    table.dropColumn('has_chat_support');
  });
};
