/**
 * Migração para criar o esquema de produto, conta e sessão de usuário
 */
exports.up = function(knex) {
  return knex.schema
    // Tabela de produtos
    .createTable('product', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 255).notNullable();
      table.string('description', 255).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    })
    
    // Tabela de contas
    .createTable('account', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('social_name', 255);
      table.string('name', 255);
      table.string('email', 255);
      table.string('phone', 255);
      table.uuid('product_id').notNullable().references('id').inTable('product');
      table.string('document', 255);
      table.text('instance');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Índice na coluna phone
      table.index('phone', 'account_phone_idx');
    })
    
    // Tabela de sessões de usuário
    .createTable('user_session', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('account_id').notNullable().references('id').inTable('account');
      table.text('phone');
      table.text('name');
      table.timestamp('creation_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('last_access').notNullable().defaultTo(knex.fn.now());
      table.uuid('product_id').references('id').inTable('product');
      
      // Índices
      table.index('account_id', 'user_session_account_idx');
      table.index('phone', 'user_session_phone_idx');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('user_session')
    .dropTableIfExists('account')
    .dropTableIfExists('product');
};
