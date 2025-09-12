exports.up = function(knex) {
  return knex.schema.createTable('user_access_profiles', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('access_profile_id').notNullable().references('id').inTable('access_profiles').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Para garantir que um usuário não tenha o mesmo perfil duplicado
    table.unique(['user_id', 'access_profile_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('user_access_profiles');
};
