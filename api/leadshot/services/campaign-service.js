const { getDbConnection } = require('../utils/database');

async function resolveInboxIdsByAccount(trx, accountId, inboxIds = [], useAllInboxes = false) {
  if (useAllInboxes) {
    const accountInboxes = await trx('inbox').where({ account_id: accountId }).select('id');
    return accountInboxes.map((inbox) => inbox.id);
  }

  if (!Array.isArray(inboxIds) || inboxIds.length === 0) {
    return [];
  }

  const rows = await trx('inbox')
    .where({ account_id: accountId })
    .whereIn('id', inboxIds)
    .select('id');

  return rows.map((row) => row.id);
}

async function syncCampaignInboxes(trx, campaignId, accountId, inboxIds = [], useAllInboxes = false) {
  const resolvedInboxIds = await resolveInboxIdsByAccount(trx, accountId, inboxIds, useAllInboxes);

  await trx('campaign_inbox').where({ campaign_id: campaignId }).del();

  if (resolvedInboxIds.length === 0) {
    return [];
  }

  const campaignInboxRows = resolvedInboxIds.map((inboxId) => ({
    campaign_id: campaignId,
    inbox_id: inboxId,
  }));

  await trx('campaign_inbox').insert(campaignInboxRows);

  return resolvedInboxIds;
}

async function listCampaignsByProduct(productId) {
  const knex = getDbConnection();
  // Join campaign -> account to filter by product_id
  return knex('campaign as c')
    .join('account as a', 'a.id', 'c.account_id')
    .leftJoin('template_message as t', 't.id', 'c.template_message_id')
    .leftJoin('contact as ct', 'ct.campaign_id', 'c.id')
    .select(
      'c.id',
      'c.name',
      'c.description',
      'c.template_message_id',
      'c.account_id',
      'c.created_at',
      knex.raw('a.name as account_name'),
      knex.raw('t.name as template_name'),
      knex.raw('COUNT(ct.id) as contact_count')
    )
    .where('a.product_id', productId)
    .groupBy(
      'c.id',
      'c.name',
      'c.description',
      'c.template_message_id',
      'c.account_id',
      'c.created_at',
      'a.name',
      't.name'
    )
    .orderBy('c.created_at', 'desc');
}

async function createCampaign({
  name,
  description = null,
  template_message_id = null,
  account_id,
  inbox_ids = [],
  use_all_inboxes = false,
}) {
  const knex = getDbConnection();

  return knex.transaction(async (trx) => {
    const [row] = await trx('campaign')
      .insert({ name, description, template_message_id, account_id })
      .returning(['id', 'name', 'description', 'template_message_id', 'account_id', 'created_at']);

    await syncCampaignInboxes(
      trx,
      row.id,
      account_id,
      inbox_ids,
      use_all_inboxes
    );

    return row;
  });
}

async function updateCampaign(
  campaignId,
  {
    name,
    description,
    template_message_id,
    account_id,
    inbox_ids,
    use_all_inboxes,
  }
) {
  const knex = getDbConnection();

  return knex.transaction(async (trx) => {
    const existingCampaign = await trx('campaign').where({ id: campaignId }).first();

    if (!existingCampaign) {
      return null;
    }

    const updatePayload = {};

    if (typeof name === 'string') {
      updatePayload.name = name;
    }

    if (description !== undefined) {
      updatePayload.description = description;
    }

    if (template_message_id !== undefined) {
      updatePayload.template_message_id = template_message_id;
    }

    if (account_id !== undefined) {
      updatePayload.account_id = account_id;
    }

    let updatedCampaign = existingCampaign;

    if (Object.keys(updatePayload).length > 0) {
      const [row] = await trx('campaign')
        .where({ id: campaignId })
        .update(updatePayload)
        .returning(['id', 'name', 'description', 'template_message_id', 'account_id', 'created_at']);

      updatedCampaign = row;
    }

    const shouldSyncInboxes = Array.isArray(inbox_ids) || use_all_inboxes === true;

    if (!shouldSyncInboxes) {
      return updatedCampaign;
    }

    await syncCampaignInboxes(
      trx,
      campaignId,
      updatedCampaign.account_id,
      inbox_ids || [],
      use_all_inboxes === true
    );

    return updatedCampaign;
  });
}

module.exports = {
  listCampaignsByProduct,
  createCampaign,
  updateCampaign,
};
