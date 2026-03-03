// TODO: implement campaign analytics service

const { getDbConnection } = require('../utils/database');

/**
 * Monta o filtro base de contatos a partir de accountId, campaignId, templateMessageId
 * Retorna a lista de contatos da base
 * @param {object} knex
 * @param {{ accountId?: string, campaignId?: string, templateMessageId?: string }} filters
 */
async function getBaseContacts(knex, filters) {
  const { accountId, campaignId, templateMessageId } = filters;

  const query = knex('contact as c')
    .leftJoin('campaign as ca', 'ca.id', 'c.campaign_id')
    .select(
      'c.id',
      'c.name',
      'c.phone',
      'c.campaign_id',
      'c.account_id',
      'c.external_status'
    );

  if (accountId) {
    query.where('c.account_id', accountId);
  }

  if (campaignId) {
    query.where('c.campaign_id', campaignId);
  }

  if (templateMessageId) {
    query.where('ca.template_message_id', templateMessageId);
  }

  return query;
}

/**
 * Calcula o resumo de contatos (total e por status)
 * @param {Array} contacts
 */
function buildContactsSummary(contacts) {
  const totalContacts = contacts.length;

  const byStatus = contacts.reduce((acc, contact) => {
    const status = contact.external_status || 'unknown';
    if (!acc[status]) acc[status] = 0;
    acc[status] += 1;
    return acc;
  }, {});

  return {
    totalContacts,
    byStatus,
  };
}

/**
 * Calcula o funil com base em conversation_funnel_step e kanban_items relacionados aos contatos
 * Regra:
 * - Topo do funil (menor ordem) recebe o total de contatos da base
 * - Cada nível N recebe a quantidade de contatos cujo estágio máximo é >= N
 * - Mesmo que um step não tenha nenhum contato, ele é retornado com countAtOrBeyond = 0
 * @param {object} knex
 * @param {Array} contacts
 */
async function buildFunnel(knex, contacts) {
  if (!contacts.length) {
    return [];
  }

  const contactIds = contacts.map((c) => c.id);
  const accountId = contacts[0] && contacts[0].account_id;

  if (!accountId) {
    return [];
  }

  const accountRow = await knex('account')
    .select('conversation_funnel_id')
    .where('id', accountId)
    .first();

  if (!accountRow || !accountRow.conversation_funnel_id) {
    return [];
  }

  // Busca todos os estágios do funil associado à account
  const steps = await knex('conversation_funnel_step as s')
    .where('s.conversation_funnel_id', accountRow.conversation_funnel_id)
    .orderBy('s.order', 'asc');

  if (!steps.length) {
    return [];
  }

  // Descobre, para cada contato, qual foi a maior ordem de etapa atingida
  const stageRows = await knex('contact as c')
    .join('user_session as us', 'us.contact_id', 'c.id')
    .join('kanban_items as ki', 'ki.user_session_id', 'us.id')
    .join('conversation_funnel_step as s', 's.id', 'ki.funnel_stage_id')
    .whereIn('c.id', contactIds)
    .where('s.conversation_funnel_id', accountRow.conversation_funnel_id)
    .select('c.id as contact_id', 's.order as step_order');

  const contactMaxOrder = new Map();
  for (const row of stageRows) {
    const order = typeof row.step_order === 'number' ? row.step_order : 0;
    const currentMax = contactMaxOrder.get(row.contact_id);
    if (currentMax === undefined || order > currentMax) {
      contactMaxOrder.set(row.contact_id, order);
    }
  }

  const totalContacts = contacts.length;

  // Contatos entregues (usando external_status dos contatos)
  const deliveredContacts = contacts.reduce((sum, contact) => {
    if (contact.external_status === 'delivered') {
      return sum + 1;
    }
    return sum;
  }, 0);

  const allContactIds = contacts.map((c) => c.id);

  const dynamicSteps = steps.map((step) => {
    const order = typeof step.order === 'number' ? step.order : 0;

    let count = 0;
    for (const contactId of allContactIds) {
      const maxOrder = contactMaxOrder.get(contactId) ?? 0;
      if (maxOrder >= order) {
        count += 1;
      }
    }

    return {
      stepId: step.id,
      name: step.name,
      kanbanCode: step.kanban_code || null,
      order: step.order,
      countAtOrBeyond: count,
    };
  });

  // Primeira linha: total de contatos (referência de percentual)
  const funnel = [
    {
      stepId: 'summary_total_contacts',
      name: 'Total de Contatos',
      kanbanCode: null,
      order: 0,
      countAtOrBeyond: totalContacts,
    },
    {
      stepId: 'summary_delivered_contacts',
      name: 'Contatos Entregues',
      kanbanCode: null,
      order: 0,
      countAtOrBeyond: deliveredContacts,
    },
    ...dynamicSteps,
  ];

  return funnel;
}

/**
 * Serviço principal: retorna resumo de contatos e funil de vendas
 * @param {{ accountId?: string, campaignId?: string, templateMessageId?: string }} filters
 */
async function getCampaignAnalytics(filters) {
  const knex = getDbConnection();

  const contacts = await getBaseContacts(knex, filters);
  const contactsSummary = buildContactsSummary(contacts);
  const funnel = await buildFunnel(knex, contacts);

  return {
    contactsSummary,
    funnel,
  };
}

module.exports = {
  getCampaignAnalytics,
};
