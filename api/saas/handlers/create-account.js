const { getDbConnection } = require('../utils/database');
const { createAccount } = require('../services/account-service');
const { createInbox } = require('../services/inbox-service');
const { success, error: errorResponse } = require('../utils/response');
const { getUserFromEvent } = require('../utils/auth-user');

/**
 * Handler para criar uma conta
 */
exports.handler = async (event) => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return errorResponse({ success: false, message: 'Corpo da requisição inválido' }, 400);
    }

    const { social_name, name, email, phone, product_id, document, instance, conversation_funnel_id, domain } = body;

    let userIdFromJwt = null;
    try {
      const auth = getUserFromEvent(event);
      if (auth && auth.user && auth.user.id) {
        userIdFromJwt = auth.user.id;
      }
    } catch (authErr) {
      console.error('[create-account] Erro ao obter usuário do JWT:', authErr?.message || authErr);
    }

    if (!product_id) {
      return errorResponse({ success: false, message: 'product_id é obrigatório' }, 400);
    }

    const created = await createAccount({ social_name, name, email, phone, product_id, document, instance, conversation_funnel_id, domain });

    // Criar inbox automaticamente usando o phone informado, se existir
    try {
      const phoneTrimmed = (phone ?? '').toString().trim();
      if (phoneTrimmed) {
        const knex = getDbConnection();
        const exists = await knex('inbox')
          .where({ account_id: created.id, name: phoneTrimmed })
          .first();
        if (!exists) {
          await createInbox({ account_id: created.id, name: phoneTrimmed });
        }
      }
    } catch (inbErr) {
      console.error('[create-account] Falha ao criar inbox padrão da conta:', inbErr?.message || inbErr);
      // Não interrompe a criação da conta
    }

    // Criar parâmetros para a nova conta baseado nos padrões (account_parameters_standard)
    try {
      const knex = getDbConnection();
      const standardParams = await knex('account_parameters_standard')
        .select('name', 'short_description', 'help_text', 'default_value')
        .orderBy('name', 'asc');
      
      if (standardParams.length > 0) {
        const seedRows = standardParams.map(param => ({
          name: param.name,
          value: param.default_value || '',
          account_id: created.id,
          short_description: param.short_description,
          help_text: param.help_text,
          default_value: param.default_value
        }));
        await knex('account_parameter').insert(seedRows);
      }
    } catch (seedErr) {
      console.error('[create-account] Falha ao semear account_parameter para a nova conta:', seedErr?.message || seedErr);
      // Não interrompe a criação da conta
    }

    // Relaciona automaticamente a conta ao usuário criador (JWT), quando aplicável
    try {
      if (userIdFromJwt) {
        const knex = getDbConnection();
        const user = await knex('users').where({ id: userIdFromJwt }).first();
        if (!user) {
          console.warn('[create-account] userIdFromJwt não encontrado na tabela users:', userIdFromJwt);
        } else {
          const EXCLUDED_PROFILE = 'b36dd047-1634-4a89-97f3-127688104dd0';
          // Buscar perfis do usuário e verificar se possui o perfil excluído
          const profiles = await knex('user_access_profiles')
            .where({ user_id: userIdFromJwt })
            .pluck('access_profile_id');
          const hasExcluded = Array.isArray(profiles) && profiles.includes(EXCLUDED_PROFILE);
          if (!hasExcluded) {
            await knex('user_accounts').insert({ user_id: userIdFromJwt, account_id: created.id });
          } else {
            console.log('[create-account] Usuário possui perfil excluído, não relacionando automaticamente user->account');
          }
        }
      }
    } catch (relErr) {
      console.error('[create-account] Falha ao relacionar usuário e conta:', relErr?.message || relErr);
      // Não interrompe a criação da conta; apenas loga o erro
    }
    return success({ success: true, message: 'Conta criada com sucesso', data: created }, 201);
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    return errorResponse({ success: false, message: 'Erro ao criar conta', error: error.message }, 500);
  }
};
