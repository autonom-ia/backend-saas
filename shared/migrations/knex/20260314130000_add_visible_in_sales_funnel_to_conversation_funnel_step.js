/**
 * Adiciona a coluna visible_in_sales_funnel na tabela conversation_funnel_step
 */

exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn(
    'conversation_funnel_step',
    'visible_in_sales_funnel'
  );

  if (hasColumn) {
    return;
  }

  await knex.schema.alterTable('conversation_funnel_step', (table) => {
    table.boolean('visible_in_sales_funnel').notNullable().defaultTo(true);
  });
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn(
    'conversation_funnel_step',
    'visible_in_sales_funnel'
  );

  if (!hasColumn) {
    return;
  }

  await knex.schema.alterTable('conversation_funnel_step', (table) => {
    table.dropColumn('visible_in_sales_funnel');
  });
};
