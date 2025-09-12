/**
 * Migração para criar a tabela conversation_funnel_register
 * 
 * Esta tabela armazena registros relacionados ao funil de conversação,
 * incluindo informações de sessões, produtos, contas e dados do Chatwoot.
 */
exports.up = function(knex) {
  return knex.schema
    // Criação da tabela conversation_funnel_register
    .createTable('conversation_funnel_register', (table) => {
      table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now()).notNullable();
      
      // Chaves estrangeiras
      table.uuid('user_session_id').references('id')
        .inTable('user_session')
        .onDelete('SET NULL')
        .onUpdate('CASCADE')
        .nullable();
      
      table.uuid('product_id').references('id')
        .inTable('product')
        .onDelete('SET NULL')
        .onUpdate('CASCADE')
        .nullable();
      
      table.uuid('account_id').references('id')
        .inTable('account')
        .onDelete('SET NULL')
        .onUpdate('CASCADE')
        .nullable();
      
      // Campos relacionados ao Chatwoot
      table.text('chatwoot_account').nullable();
      table.text('chatwoot_inbox').nullable();
      table.text('chatwoot_conversations').nullable();
      
      // Campos adicionais
      table.text('conversation_funnel_step_id').nullable();
      table.text('summary').nullable();
      table.timestamp('last_timestamptz', { useTz: true }).defaultTo(knex.fn.now()).notNullable();
      
      // Campos de texto (anteriormente arrays)
      table.text('declared_interests').nullable();
      table.text('mentioned_products').nullable();
      table.text('points_attention_objections').nullable();
      
      // Definir constraint de chave primária
      table.primary(['id'], { constraintName: 'saas_conversation_funnel_register_pkey' });
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('conversation_funnel_register');
};
