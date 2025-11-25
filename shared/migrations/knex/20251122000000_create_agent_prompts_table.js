/**
 * Migração para criar a tabela de prompts/instruções do agente
 * Cada produto pode ter múltiplos prompts identificados por um código/slug
 */
exports.up = function(knex) {
  return knex.schema.createTable('agent_prompts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').notNullable().references('id').inTable('product').onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.string('code', 100).notNullable(); // slug para identificar o tipo de prompt (ex: 'general', 'welcome', 'closing')
    table.text('content').notNullable(); // Campo TEXT para suportar muito texto
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    
    // Índices
    table.index('product_id', 'agent_prompts_product_idx');
    table.index('code', 'agent_prompts_code_idx');
    
    // Garantir que não haja duplicatas de código por produto
    table.unique(['product_id', 'code'], 'agent_prompts_product_code_unique');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('agent_prompts');
};

