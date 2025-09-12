/**
 * Migração para criar a tabela empresta_assigned_contacts_register
 * Esta tabela armazena o registro de atribuições de contatos do Chatwoot
 */

exports.up = function(knex) {
  // Primeiro criamos a extensão uuid-ossp para ter acesso à função uuid_generate_v4()
  return knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    .then(() => {
      return knex.schema.createTable('empresta_assigned_contacts_register', (table) => {
        // Primary key
        table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
        
        // Campos obrigatórios
        table.integer('inbox_id').notNullable();
        table.integer('user_id').notNullable();
        table.integer('contact_id').notNullable();
        
        // Timestamp automático
        table.timestamp('assign_time').defaultTo(knex.fn.now());
        
        // Índices para melhor performance em consultas
        table.index(['inbox_id', 'user_id']);
        table.index('contact_id');
      });
    });
};

exports.down = function(knex) {
  // Revert: remover a tabela se precisarmos fazer rollback
  return knex.schema.dropTableIfExists('empresta_assigned_contacts_register');
};
