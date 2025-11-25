/**
 * Adiciona campos de soft delete e controle de ativo/inativo na tabela agent_prompts
 */
exports.up = function(knex) {
  // Primeiro remover a constraint unique antiga
  return knex.raw(`
    ALTER TABLE agent_prompts 
    DROP CONSTRAINT IF EXISTS agent_prompts_product_code_unique;
  `).then(() => {
    // Depois adicionar os novos campos
    return knex.schema.table('agent_prompts', (table) => {
      table.boolean('is_active').defaultTo(true).notNullable();
      table.boolean('is_deleted').defaultTo(false).notNullable();
      table.timestamp('deleted_at', { useTz: true }).nullable();
      table.uuid('deleted_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      
      // Índices para melhor performance nas queries
      table.index('is_active', 'agent_prompts_is_active_idx');
      table.index('is_deleted', 'agent_prompts_is_deleted_idx');
      table.index(['product_id', 'code', 'is_active'], 'agent_prompts_product_code_active_idx');
    });
  });
};

exports.down = function(knex) {
  return knex.schema.table('agent_prompts', (table) => {
    table.dropIndex('agent_prompts_product_code_active_idx');
    table.dropIndex('agent_prompts_is_deleted_idx');
    table.dropIndex('agent_prompts_is_active_idx');
    table.dropColumn('deleted_by');
    table.dropColumn('deleted_at');
    table.dropColumn('is_deleted');
    table.dropColumn('is_active');
  }).then(() => {
    // Recriar a constraint unique original
    return knex.raw(`
      ALTER TABLE agent_prompts 
      ADD CONSTRAINT agent_prompts_product_code_unique 
      UNIQUE (product_id, code);
    `);
  });
};

