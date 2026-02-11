const { getDbConnection } = require('../utils/database');
const { createAccount } = require('../services/account-service');
const { createInbox } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { getUserFromEvent } = require('../utils/auth-user');
const {
  resolvePlanFromOnboarding,
  createAccountSubscription,
  associateOnboardingData,
} = require('../services/financial-service-client');

const EXCLUDED_PROFILE_ID = 'b36dd047-1634-4a89-97f3-127688104dd0';

const parseBody = (raw) => {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
};

const ensureInboxForAccount = async (created, phone) => {
  const phoneTrimmed = (phone ?? '').toString().trim();
  if (!phoneTrimmed) return;

  const knex = getDbConnection();
  const exists = await knex('inbox')
    .where({ account_id: created.id, name: phoneTrimmed })
    .first();
  if (exists) return;

  await createInbox({ account_id: created.id, name: phoneTrimmed });
};

const seedAccountParameters = async (created) => {
  const knex = getDbConnection();
  const standardParams = await knex('account_parameters_standard')
    .select('name', 'short_description', 'help_text', 'default_value')
    .orderBy('name', 'asc');

  if (standardParams.length === 0) return;

  const seedRows = standardParams.map((param) => ({
    name: param.name,
    value: param.default_value || '',
    account_id: created.id,
    short_description: param.short_description,
    help_text: param.help_text,
    default_value: param.default_value,
  }));
  await knex('account_parameter').insert(seedRows);
};

const linkUserToAccountIfApplicable = async (event, created) => {
  const userContext = await getUserFromEvent(event);
  const userId = userContext?.user?.id;
  if (!userId) return;

  const knex = getDbConnection();
  const user = await knex('users').where({ id: userId }).first();
  if (!user) return;

  const profiles = await knex('user_access_profiles')
    .where({ user_id: userId })
    .pluck('access_profile_id');
  const hasExcluded = Array.isArray(profiles) && profiles.includes(EXCLUDED_PROFILE_ID);
  if (hasExcluded) return;

  await knex('user_accounts').insert({ user_id: userId, account_id: created.id });
};

const getBearerToken = (event) => {
  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
};

const resolveProductPlanId = async (body, created, token) => {
  const fromBody = body.product_plan_id;
  if (fromBody) return fromBody;
  if (!token) return null;

  const doc = body.document != null ? body.document : (created.document || '');
  if (!doc) return null;

  const resolveResult = await resolvePlanFromOnboarding(
    { document: String(doc).trim(), companyId: body.company_id ?? null },
    token
  );
  return resolveResult?.productPlanId ?? null;
};

const createSubscriptionAndAssociate = async (created, body, token) => {
  const productPlanId = await resolveProductPlanId(body, created, token);
  if (!productPlanId) return { subscriptionPlanRequired: true };

  const subBody = {
    accountId: created.id,
    productPlanId,
    customPrice: body.custom_price != null ? body.custom_price : null,
    currency: 'BRL',
  };
  const sub = await createAccountSubscription(subBody, token);
  if (!sub?.id) return { subscriptionPlanRequired: false };

  const doc = body.document != null ? body.document : (created.document || '');
  if (!doc) return { subscriptionPlanRequired: false };

  await associateOnboardingData(
    {
      accountId: created.id,
      accountSubscriptionId: sub.id,
      document: String(doc).trim(),
      companyId: body.company_id ?? null,
    },
    token
  );
  return { subscriptionPlanRequired: false };
};

const runSubscriptionFlow = async (created, body, event) => {
  try {
    const token = getBearerToken(event);
    return await createSubscriptionAndAssociate(created, body, token);
  } catch {
    return { subscriptionPlanRequired: true };
  }
};

exports.handler = async (event) => {
  try {
    const body = parseBody(event.body);
    if (!body) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { social_name, name, email, phone, product_id, document, instance, conversation_funnel_id, domain } = body;

    if (!product_id) {
      return errorResponse({ success: false, message: 'product_id é obrigatório' }, 400);
    }

    const created = await createAccount({
      social_name,
      name,
      email,
      phone,
      product_id,
      document,
      instance,
      conversation_funnel_id,
      domain,
    });

    await ensureInboxForAccount(created, phone).catch(() => {});
    await seedAccountParameters(created).catch(() => {});
    await linkUserToAccountIfApplicable(event, created).catch(() => {});

    const { subscriptionPlanRequired } = await runSubscriptionFlow(created, body, event);

    const payload = {
      success: true,
      message: 'Conta criada com sucesso',
      data: created,
      ...(subscriptionPlanRequired && {
        subscriptionPlanRequired: true,
        accountId: created.id,
        document: body.document != null ? body.document : (created.document ?? null),
        productId: product_id,
      }),
    };

    return success(payload, 201);
  } catch (error) {
    return errorResponse(
      { success: false, message: 'Erro ao criar conta', error: error.message },
      500
    );
  }
};
