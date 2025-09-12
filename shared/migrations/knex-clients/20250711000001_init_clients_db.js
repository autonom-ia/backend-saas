/**
 * Migração inicial para o banco de dados de clientes
 * Cria apenas as tabelas de controle do Knex para gerenciar as migrações
 */

exports.up = function(knex) {
  // O Knex criará automaticamente a tabela knex_migrations_clients
  // quando executarmos a primeira migração, então não precisamos
  // criá-la explicitamente.
  
  // Esta migração serve apenas como um marcador inicial
  // para o sistema de migrações do banco de dados de clientes.
  return Promise.resolve();
};

exports.down = function(knex) {
  // Como não criamos nenhuma tabela no método up,
  // não precisamos fazer nada aqui.
  return Promise.resolve();
};
