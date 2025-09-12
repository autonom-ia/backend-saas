/**
 * Migração para criar tabelas de funil de conversação e adicionar relações necessárias
 * 
 * Cria as seguintes tabelas:
 * - conversation_funnel
 * - conversation_funnel_step
 * - conversation_funnel_step_message
 * - user_session_conversation_funnel_step_message
 * 
 * Também adiciona relações às tabelas existentes:
 * - account: adiciona conversation_funnel_id
 * - user_session: adiciona conversation_funnel_step_id
 */
exports.up = function(knex) {
  return knex.schema
    // Criação da tabela conversation_funnel
    .createTable('conversation_funnel', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 255).notNullable();
      table.string('description', 255).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Definir constraint de chave primária
      table.primary(['id'], { constraintName: 'saas_conversation_funnel_pkey' });
    })
    
    // Criação da tabela conversation_funnel_step
    .createTable('conversation_funnel_step', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 255).notNullable();
      table.string('description', 255).notNullable();
      table.uuid('conversation_funnel_id').notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Chave estrangeira para conversation_funnel
      table.foreign('conversation_funnel_id')
        .references('id')
        .inTable('conversation_funnel')
        .onDelete('CASCADE')
        .onUpdate('CASCADE');
        
      // Definir constraint de chave primária
      table.primary(['id'], { constraintName: 'saas_conversation_funnel_step_pkey' });
    })
    
    // Criação da tabela conversation_funnel_step_message
    .createTable('conversation_funnel_step_message', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name', 255).notNullable();
      table.string('description', 255).notNullable();
      table.uuid('conversation_funnel_step_id').notNullable();
      table.bigInteger('shipping_time');
      table.bigInteger('shipping_order');
      table.text('message_instruction');
      table.text('fixed_message');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Chave estrangeira para conversation_funnel_step
      table.foreign('conversation_funnel_step_id')
        .references('id')
        .inTable('conversation_funnel_step')
        .onDelete('CASCADE')
        .onUpdate('CASCADE');
        
      // Definir constraint de chave primária
      table.primary(['id'], { constraintName: 'saas_conversation_funnel_step_message_pkey' });
    })
    
    // Criação da tabela user_session_conversation_funnel_step_message
    .createTable('user_session_conversation_funnel_step_message', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('conversation_funnel_step_message_id').notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      
      // Chave estrangeira para conversation_funnel_step_message
      table.foreign('conversation_funnel_step_message_id')
        .references('id')
        .inTable('conversation_funnel_step_message')
        .onDelete('CASCADE')
        .onUpdate('CASCADE');
        
      // Definir constraint de chave primária
      table.primary(['id'], { constraintName: 'saas_user_session_conversation_funnel_step_message_pkey' });
    })
    
    // Alteração da tabela account para adicionar relação com conversation_funnel
    .then(() => {
      return knex.schema.alterTable('account', (table) => {
        table.uuid('conversation_funnel_id').nullable();
        table.foreign('conversation_funnel_id')
          .references('id')
          .inTable('conversation_funnel')
          .onDelete('SET NULL')
          .onUpdate('CASCADE');
      });
    })
    
    // Alteração da tabela user_session para adicionar relação com conversation_funnel_step
    .then(() => {
      return knex.schema.alterTable('user_session', (table) => {
        table.uuid('conversation_funnel_step_id').nullable();
        table.foreign('conversation_funnel_step_id')
          .references('id')
          .inTable('conversation_funnel_step')
          .onDelete('SET NULL')
          .onUpdate('CASCADE');
      });
    });
};

/**
 * Reverter a migração
 */
exports.down = function(knex) {
  return knex.schema
    // Remover as relações das tabelas existentes
    .alterTable('user_session', (table) => {
      table.dropForeign(['conversation_funnel_step_id']);
      table.dropColumn('conversation_funnel_step_id');
    })
    .alterTable('account', (table) => {
      table.dropForeign(['conversation_funnel_id']);
      table.dropColumn('conversation_funnel_id');
    })
    
    // Remover as novas tabelas na ordem inversa de criação
    .dropTableIfExists('user_session_conversation_funnel_step_message')
    .dropTableIfExists('conversation_funnel_step_message')
    .dropTableIfExists('conversation_funnel_step')
    .dropTableIfExists('conversation_funnel');
};
