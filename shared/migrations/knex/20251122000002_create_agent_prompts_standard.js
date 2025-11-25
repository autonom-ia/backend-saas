/**
 * Migração para criar a tabela agent_prompts_standard
 * Define prompts padrão que serão criados automaticamente para todos os produtos
 */
exports.up = function(knex) {
  return knex.schema.createTable('agent_prompts_standard', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title', 255).notNullable();
    table.string('code', 100).notNullable().unique(); // Código único (ex: 'general', 'welcome', 'closing')
    table.text('content').notNullable(); // Conteúdo padrão (pode ser vazio ou genérico)
    table.integer('order').defaultTo(0); // Ordem de exibição
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    
    // Índice para melhor performance
    table.index('code', 'agent_prompts_standard_code_idx');
    table.index('order', 'agent_prompts_standard_order_idx');
  }).then(() => {
    // Inserir os prompts padrão iniciais
    return knex('agent_prompts_standard').insert([
      {
        title: 'Geral',
        code: 'general',
        content: 'Você é um assistente virtual especializado em ajudar os clientes. Seja cordial, profissional e objetivo em suas respostas.',
        order: 1
      },
      {
        title: 'Boas Vindas',
        code: 'welcome',
        content: 'Olá! Bem-vindo! Como posso ajudá-lo hoje?',
        order: 2
      },
      {
        title: 'Encerramento',
        code: 'closing',
        content: 'Foi um prazer ajudá-lo! Se precisar de mais alguma coisa, estarei à disposição. Tenha um ótimo dia!',
        order: 3
      }
    ]);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('agent_prompts_standard');
};

