const { getDbConnection } = require('../utils/database');
const { createAccount } = require('../services/account-service');
const { createInbox } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { getUserFromEvent } = require('../utils/auth-user');

/**
 * Handler para criar uma conta via fluxo de onboarding
 * Cria a conta + inbox + parâmetros de uma vez
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const {
      accountName,
      accountEmail,
      accountPhone,
      productId,
      parameters = {},
      user_id,
      document,
      productPlanId: bodyProductPlanId,
      sessionId: bodySessionId,
    } = body;

    // Validações
    if (!productId) {
      return errorResponse({ success: false, message: 'productId é obrigatório' }, 400);
    }
    if (!accountName || !accountName.trim()) {
      return errorResponse({ success: false, message: 'accountName é obrigatório' }, 400);
    }
    if (!accountEmail || !accountEmail.trim()) {
      return errorResponse({ success: false, message: 'accountEmail é obrigatório' }, 400);
    }
    if (!accountPhone || !accountPhone.trim()) {
      return errorResponse({ success: false, message: 'accountPhone é obrigatório' }, 400);
    }

    // Criar conta
    const created = await createAccount({ 
      name: accountName,
      social_name: accountName,
      email: accountEmail,
      phone: accountPhone,
      product_id: productId,
      document,
    });

    const accountId = created.id;
    const knex = getDbConnection();

    // Criar parâmetro 'document' na account_parameter com o mesmo valor da conta
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
        console.log('[create-account-onboarding] Parâmetro document criado com sucesso');
      }
    } catch (docErr) {
      console.error('[create-account-onboarding] Falha ao criar parâmetro document:', docErr?.message || docErr);
      // Não interrompe a criação da conta
    }

    // Criar inbox automaticamente
    try {
      const phoneTrimmed = accountPhone.toString().trim();
      if (phoneTrimmed) {
        const exists = await knex('inbox')
          .where({ account_id: accountId, name: phoneTrimmed })
          .first();
        if (!exists) {
          await createInbox({ account_id: accountId, name: phoneTrimmed });
        }
      }
    } catch (inbErr) {
      console.error('[create-account-onboarding] Falha ao criar inbox:', inbErr?.message || inbErr);
    }

    // Criar parâmetro knowledgeBase se metadata vier no body
    try {
      if (parameters['metadata']) {
        const metadataValue = parameters['metadata'];
        let knowledgeBaseValue = '';
        
        // Validar e formatar JSON
        if (typeof metadataValue === 'string' && metadataValue.trim().startsWith('{')) {
          try {
            JSON.parse(metadataValue);
            knowledgeBaseValue = metadataValue;
          } catch (err) {
            console.error('[create-account-onboarding] JSON metadata inválido:', err.message);
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
            help_text: 'Conjunto de informações utilizadas pela empresa para serem utilizadas na instrução do agente.',
            default_value: null
          });
          console.log('[create-account-onboarding] knowledgeBase criado com sucesso');
        }
      }
    } catch (kbErr) {
      console.error('[create-account-onboarding] Falha ao criar knowledgeBase:', kbErr?.message || kbErr);
      // Não interrompe a criação da conta
    }

    // Buscar outros parâmetros standard e criar para a conta (exceto metadata, knowledgeBase e document)
    try {
      const standardParams = await knex('account_parameters_standard')
        .select('name', 'short_description', 'help_text', 'default_value')
        .whereNotIn('name', ['metadata', 'knowledgeBase', 'document']) // Exclui metadata (já tratada), knowledgeBase e document (já criado acima)
        .orderBy('name', 'asc');
      
      if (standardParams.length > 0) {
        const paramRows = standardParams.map(param => {
          // Usar valor fornecido pelo usuário ou default
          const userValue = parameters[param.name];
          const finalValue = userValue !== undefined && userValue !== null 
            ? String(userValue) 
            : (param.default_value || '');

          return {
            name: param.name,
            value: finalValue,
            account_id: accountId,
            short_description: param.short_description,
            help_text: param.help_text,
            default_value: param.default_value
          };
        });
        
        await knex('account_parameter').insert(paramRows);
        console.log(`[create-account-onboarding] Criados ${paramRows.length} parâmetros adicionais para a conta`);
      }
    } catch (seedErr) {
      console.error('[create-account-onboarding] Falha ao criar parâmetros:', seedErr?.message || seedErr);
      // Não interrompe a criação da conta
    }

    // Relacionar usuário à conta usando preferencialmente o usuário do JWT, com fallback em user_id do body
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
            console.log('[create-account-onboarding] Usuário relacionado à conta (effectiveUserId):', effectiveUserId);
          } else {
            console.log('[create-account-onboarding] Usuário possui perfil excluído, não relacionando automaticamente user->account');
          }
        } else {
          console.warn('[create-account-onboarding] Usuário não encontrado para effectiveUserId:', effectiveUserId);
        }
      } else {
        console.warn('[create-account-onboarding] Nenhum usuário resolvido (JWT ou body user_id); não será criado vínculo user->account');
      }
    } catch (relErr) {
      console.error('[create-account-onboarding] Falha ao relacionar usuário:', relErr?.message || relErr);
      // Não interrompe a criação da conta
    }

    // Assinatura é completada pelo frontend (browser → financial-service) para evitar Lambda em VPC chamar API/Lambda (exige VPC Endpoint ou NAT). Quando há productPlanId, retornamos subscriptionPlanRequired + accountId/document/productId para o front chamar POST /account-subscriptions/complete.
    const productPlanId = bodyProductPlanId ?? body.productPlanId ?? body.product_plan_id ?? null;
    const subscriptionPlanRequired = !!productPlanId;
    if (productPlanId) {
      console.log('[create-account-onboarding] productPlanId enviado; frontend completará assinatura via financial-service:', productPlanId);
    }

    // Marcar is_first_login = false para que getUserByEmail retorne o valor correto e o usuário saia do loop de onboarding
    try {
      const userContext = await getUserFromEvent(event);
      const jwtUserId = userContext && userContext.user && userContext.user.id;
      const effectiveUserId = jwtUserId || user_id;
      if (effectiveUserId) {
        const updated = await knex('users')
          .where({ id: effectiveUserId })
          .update({ is_first_login: false, updated_at: knex.fn.now() });
        if (updated) {
          console.log('[create-account-onboarding] is_first_login atualizado para false (userId):', effectiveUserId);
        }
      }
    } catch (firstLoginErr) {
      console.error('[create-account-onboarding] Falha ao atualizar is_first_login:', firstLoginErr?.message || firstLoginErr);
      // Não interrompe; o front pode usar cookie/updateUserFirstLogin como fallback
    }

    const payload = { 
      success: true, 
      message: 'Conta criada com sucesso', 
      data: { 
        ...created,
        parametersCreated: true 
      } 
    };
    if (subscriptionPlanRequired) {
      payload.subscriptionPlanRequired = true;
      payload.accountId = accountId;
      payload.document = document != null ? document : (created.document || null);
      payload.productId = productId;
    }
    return success(payload, 201);
  } catch (error) {
    console.error('Erro ao criar conta (onboarding):', error);
    return errorResponse({ 
      success: false, 
      message: 'Erro ao criar conta', 
      error: error.message 
    }, 500);
  }
};
