const NON_AUTHENTICATED_ERROR_STATUSES = [
  'erro (não autenticada)',
  'erro (nao autenticada)',
  'erro_nao_autenticada',
  'error_not_authenticated',
  'not_authenticated',
];

const resolveContactForCampaignInbox = async (db, contactId) => {
  if (!contactId) {
    return null;
  }

  return db('contact')
    .where({ id: contactId })
    .select('id', 'campaign_id', 'inbox_id', 'account_id')
    .first();
};

const updateCampaignInboxDispatchFromContact = async ({
  db,
  contactId,
  inboxId,
  status,
}) => {
  const contact = await resolveContactForCampaignInbox(db, contactId);

  if (!contact || !contact.campaign_id) {
    return null;
  }

  const resolvedInboxId = inboxId || contact.inbox_id;

  if (!resolvedInboxId) {
    return null;
  }

  await db('contact')
    .where({ id: contact.id })
    .update({
      inbox_id: resolvedInboxId,
      updated_at: db.fn.now(),
    });

  const payload = {
    campaign_id: contact.campaign_id,
    inbox_id: resolvedInboxId,
    last_send_at: db.fn.now(),
    last_send_status: status || null,
    updated_at: db.fn.now(),
  };

  await db('campaign_inbox')
    .insert(payload)
    .onConflict(['campaign_id', 'inbox_id'])
    .merge({
      last_send_at: db.fn.now(),
      last_send_status: status || null,
      updated_at: db.fn.now(),
    });

  return {
    campaign_id: contact.campaign_id,
    inbox_id: resolvedInboxId,
    last_send_status: status || null,
  };
};

const getInboxLongestWithoutSend = async ({ db, campaignId }) => {
  if (!campaignId) {
    throw new Error('campaign_id é obrigatório');
  }

  const campaign = await db('campaign')
    .where({ id: campaignId })
    .select('id', 'account_id')
    .first();

  if (!campaign) {
    return null;
  }

  const campaignInbox = await db('campaign_inbox as ci')
    .leftJoin('inbox as i', 'i.id', 'ci.inbox_id')
    .where('ci.campaign_id', campaign.id)
    .where((builder) => {
      builder.whereNull('ci.last_send_status').orWhereNotIn('ci.last_send_status', NON_AUTHENTICATED_ERROR_STATUSES);
    })
    .select(
      'ci.id',
      'ci.campaign_id',
      'ci.inbox_id',
      'ci.last_send_status',
      'ci.last_send_at',
      'i.name as inbox_name'
    )
    .orderByRaw('COALESCE(ci.last_send_at, to_timestamp(0)) ASC')
    .orderBy('ci.created_at', 'asc')
    .first();

  if (campaignInbox) {
    return campaignInbox;
  }

  const fallbackInbox = await db('inbox')
    .where({ account_id: campaign.account_id })
    .select('id', 'name', 'created_at')
    .orderBy('created_at', 'asc')
    .first();

  if (!fallbackInbox) {
    return null;
  }

  return {
    id: null,
    campaign_id: campaign.id,
    inbox_id: fallbackInbox.id,
    inbox_name: fallbackInbox.name,
    last_send_status: null,
    last_send_at: null,
  };
};

module.exports = {
  updateCampaignInboxDispatchFromContact,
  getInboxLongestWithoutSend,
};
