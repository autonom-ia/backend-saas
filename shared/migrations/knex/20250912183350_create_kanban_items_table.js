/**
 * Migração para criar a tabela kanban_items
 *
 * Campos e relações:
 * - id: uuid PK
 * - account_id: uuid (FK account.id)
 * - funnel_id: uuid (FK conversation_funnel.id)
 * - funnel_stage_id: uuid (FK conversation_funnel_step.id)
 * - user_session_id: uuid (FK user_session.id)
 * - position: int4
 * - summary: varchar
 * - title: varchar
 * - timer_started_at: timestamp(6) com timezone (nullable)
 * - timer_duration: int4 default 0
 * - created_at, updated_at: timestamp com timezone default now()
 */

exports.up = function(knex) {
  return knex.schema.createTable('kanban_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('account_id').notNullable();
    table
      .foreign('account_id')
      .references('id')
      .inTable('account');

    table.uuid('funnel_id').notNullable();
    table
      .foreign('funnel_id')
      .references('id')
      .inTable('conversation_funnel');

    table.uuid('funnel_stage_id').notNullable();
    table
      .foreign('funnel_stage_id')
      .references('id')
      .inTable('conversation_funnel_step');

    table.uuid('user_session_id').notNullable();
    table
      .foreign('user_session_id')
      .references('id')
      .inTable('user_session');

    table.integer('position').notNullable();
    table.string('summary').notNullable();
    table.string('title').notNullable();

    table.timestamp('timer_started_at', { useTz: true }).nullable();
    table.integer('timer_duration').notNullable().defaultTo(0);

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Índices úteis
    table.index(['account_id'], 'kanban_items_account_id_idx');
    table.index(['funnel_id'], 'kanban_items_funnel_id_idx');
    table.index(['funnel_stage_id'], 'kanban_items_funnel_stage_id_idx');
    table.index(['user_session_id'], 'kanban_items_user_session_id_idx');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('kanban_items');
};
