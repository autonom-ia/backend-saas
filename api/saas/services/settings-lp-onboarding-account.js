/**
 * Lógica de criação de conta alinhada ao fluxo POST /Autonomia/Saas/Onboarding/Accounts,
 * isolada para uso apenas pela rota Settings (LP). Não altera o handler create-account-onboarding.
 */

const { getDbConnection } = require('../utils/database');
const { createAccount } = require('./account-service');
const { createInbox } = require('./inbox-service');
const { getUserFromEvent } = require('../utils/auth-user');

const normalizeDocument = (value) => {
  if (value == null) return null;
  const normalized = value.toString().replace(/\D/g, '').trim();
  return normalized || null;
};

const buildAccountPayload = ({ account, productPlanId, document, productId, message }) => {
  const data = {
    ...account,
    parametersCreated: true,
  };
  const extra = {};
  if (productPlanId) {
    extra.subscriptionPlanRequired = true;
    extra.accountId = account.id;
    extra.document = document != null ? document : account.document || null;
    extra.productId = productId;
  }
  return { data, extra, message };
};

async function runLpOnboardingAccountCreation(event, body) {
  const {
    accountName,
    accountEmail,
    accountPhone,
    productId,
    parameters = {},
    user_id,
    document,
    productPlanId: bodyProductPlanId,
  } = body;

  if (!productId) {
    return { ok: false, httpStatus: 400, body: { success: false, message: 'productId é obrigatório' } };
  }
  if (!accountName || !String(accountName).trim()) {
    return { ok: false, httpStatus: 400, body: { success: false, message: 'accountName é obrigatório' } };
  }
  if (!accountEmail || !String(accountEmail).trim()) {
    return { ok: false, httpStatus: 400, body: { success: false, message: 'accountEmail é obrigatório' } };
  }
  if (!accountPhone || !String(accountPhone).trim()) {
    return { ok: false, httpStatus: 400, body: { success: false, message: 'accountPhone é obrigatório' } };
  }

  const knex = getDbConnection();
  const normalizedDocument = normalizeDocument(document);
  const productPlanId =
    bodyProductPlanId ?? body.productPlanId ?? body.product_plan_id ?? null;

  if (normalizedDocument) {
    const existingAccount = await knex('account')
      .where({ product_id: productId })
      .whereRaw("regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g') = ?", [normalizedDocument])
      .first();

    if (existingAccount) {
      console.log('[settings-lp-onboarding-account] Conta existente (document+productId)', {
        accountId: existingAccount.id,
        productId,
        normalizedDocument,
      });
      const { data, extra, message } = buildAccountPayload({
        account: existingAccount,
        productPlanId,
        document,
        productId,
        message: 'Conta encontrada com sucesso',
      });
      return {
        ok: true,
        httpStatus: 200,
        account: existingAccount,
        productPlanId,
        document,
        productId,
        message,
        accountPayload: { success: true, message, data, ...extra },
      };
    }
  }

  const created = await createAccount({
    name: accountName,
    social_name: accountName,
    email: accountEmail,
    phone: accountPhone,
    product_id: productId,
    document,
  });

  const accountId = created.id;

  try {
    if (document && document.toString().trim()) {
      await knex('account_parameter').insert({
        name: 'document',
        value: document.toString(),
        account_id: accountId,
        short_description: 'Documento',
        help_text: 'Documento (CPF/CNPJ) associado à conta.',
        default_value: null,
      });
    }
  } catch (docErr) {
    console.error('[settings-lp-onboarding-account] Falha parâmetro document:', docErr?.message || docErr);
  }

  try {
    const rawPhone = accountPhone.toString().trim();
    if (rawPhone) {
      const digits = rawPhone.replace(/\D/g, '');
      const normalizedPhone = digits.startsWith('55') ? digits : `55${digits}`;
      const exists = await knex('inbox')
        .where({ account_id: accountId, name: normalizedPhone })
        .first();
      if (!exists) {
        await createInbox({ account_id: accountId, name: normalizedPhone });
      }
    }
  } catch (inbErr) {
    console.error('[settings-lp-onboarding-account] Falha inbox:', inbErr?.message || inbErr);
  }

  try {
    if (parameters['metadata']) {
      const metadataValue = parameters['metadata'];
      let knowledgeBaseValue = '';
      if (typeof metadataValue === 'string' && metadataValue.trim().startsWith('{')) {
        try {
          JSON.parse(metadataValue);
          knowledgeBaseValue = metadataValue;
        } catch (err) {
          console.error('[settings-lp-onboarding-account] JSON metadata inválido:', err.message);
        }
      } else if (typeof metadataValue === 'object') {
        knowledgeBaseValue = JSON.stringify(metadataValue);
      }
      if (knowledgeBaseValue) {
        await knex('account_parameter').insert({
          name: 'knowledgeBase',
          value: knowledgeBaseValue,
          account_id: accountId,
          short_description: 'Base de Conhecimento',
          help_text:
            'Conjunto de informações utilizadas pela empresa para serem utilizadas na instrução do agente.',
          default_value: null,
        });
      }
    }
  } catch (kbErr) {
    console.error('[settings-lp-onboarding-account] Falha knowledgeBase:', kbErr?.message || kbErr);
  }

  try {
    const standardParams = await knex('account_parameters_standard')
      .select('name', 'short_description', 'help_text', 'default_value')
      .whereNotIn('name', ['metadata', 'knowledgeBase', 'document'])
      .orderBy('name', 'asc');

    if (standardParams.length > 0) {
      const paramRows = standardParams.map((param) => {
        const userValue = parameters[param.name];
        const finalValue =
          userValue !== undefined && userValue !== null
            ? String(userValue)
            : param.default_value || '';
        return {
          name: param.name,
          value: finalValue,
          account_id: accountId,
          short_description: param.short_description,
          help_text: param.help_text,
          default_value: param.default_value,
        };
      });
      await knex('account_parameter').insert(paramRows);
    }
  } catch (seedErr) {
    console.error('[settings-lp-onboarding-account] Falha parâmetros standard:', seedErr?.message || seedErr);
  }

  try {
    const userContext = await getUserFromEvent(event);
    const jwtUserId = userContext && userContext.user && userContext.user.id;
    const effectiveUserId = jwtUserId || user_id;

    if (effectiveUserId) {
      const user = await knex('users').where({ id: effectiveUserId }).first();
      if (user) {
        const EXCLUDED_PROFILE = 'b36dd047-1634-4a89-97f3-127688104dd0';
        const profiles = await knex('user_access_profiles')
          .where({ user_id: effectiveUserId })
          .pluck('access_profile_id');
        const hasExcluded = Array.isArray(profiles) && profiles.includes(EXCLUDED_PROFILE);

        if (!hasExcluded) {
          await knex('user_accounts').insert({ user_id: effectiveUserId, account_id: accountId });
        }
      }
    }
  } catch (relErr) {
    console.error('[settings-lp-onboarding-account] Falha user_accounts:', relErr?.message || relErr);
  }

  try {
    const userContext = await getUserFromEvent(event);
    const jwtUserId = userContext && userContext.user && userContext.user.id;
    const effectiveUserId = jwtUserId || user_id;
    if (effectiveUserId) {
      await knex('users')
        .where({ id: effectiveUserId })
        .update({ is_first_login: false, updated_at: knex.fn.now() });
    }
  } catch (firstLoginErr) {
    console.error('[settings-lp-onboarding-account] Falha is_first_login:', firstLoginErr?.message || firstLoginErr);
  }

  const { data, extra, message } = buildAccountPayload({
    account: created,
    productPlanId,
    document,
    productId,
    message: 'Conta criada com sucesso',
  });

  return {
    ok: true,
    httpStatus: 201,
    account: created,
    productPlanId,
    document,
    productId,
    message,
    accountPayload: { success: true, message, data, ...extra },
  };
}

module.exports = {
  runLpOnboardingAccountCreation,
};
