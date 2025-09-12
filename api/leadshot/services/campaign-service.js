const { getDbConnection } = require('../utils/database');

async function listCampaignsByProduct(productId) {
  const knex = getDbConnection();
  // Join campaign -> account to filter by product_id
  return knex('campaign as c')
    .join('account as a', 'a.id', 'c.account_id')
    .leftJoin('template_message as t', 't.id', 'c.template_message_id')
    .select(
      'c.id',
      'c.name',
      'c.description',
      'c.template_message_id',
      'c.account_id',
      'c.created_at',
      knex.raw('a.name as account_name'),
      knex.raw('t.name as template_name')
    )
    .where('a.product_id', productId)
    .orderBy('c.created_at', 'desc');
}

async function createCampaign({ name, description = null, template_message_id = null, account_id }) {
  const knex = getDbConnection();
  const [row] = await knex('campaign')
    .insert({ name, description, template_message_id, account_id })
    .returning(['id', 'name', 'description', 'template_message_id', 'account_id', 'created_at']);
  return row;
}

module.exports = {
  listCampaignsByProduct,
  createCampaign,
};
