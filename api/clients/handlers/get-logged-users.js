/**
 * Handler para retornar usuários logados (agentes online) na plataforma.
 * Aceita: accountId (chatwoot-account) OU domain
 * 
 * Quando buscar por domain, retorna usuários de TODAS as contas associadas ao domain
 */

const { getLoggedUsersDetails } = require('../services/assign-service');
const { getDbConnection } = require('../utils/database');
const { success, error } = require('../utils/response');

module.exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};

    const rawAccountId = qs.accountId || qs.account_id || pathParams.accountId || pathParams.account_id;
    const rawSystemAccountId = qs.systemAccountId || qs.system_account_id || pathParams.systemAccountId;
    const domain = qs.domain;
    
    const db = getDbConnection();

    // Opção 1: Buscar via domain (pode ter múltiplas contas)
    if (domain && !rawAccountId) {
      console.log(`Buscando contas via domain: ${domain}`);
      
      // Buscar TODAS as contas com este domain
      const accounts = await db('account')
        .select('id')
        .where({ domain });
      
      if (!accounts || accounts.length === 0) {
        return error(`Nenhuma account encontrada para domain=${domain}`, 404);
      }
      
      console.log(`Encontradas ${accounts.length} conta(s) para domain=${domain}`);
      
      // Para cada conta, buscar chatwoot-account e usuários logados
      const allUsers = [];
      const accountsInfo = [];
      
      for (const account of accounts) {
        const systemAccountId = account.id;
        
        // Buscar chatwoot-account via account_parameter
        const chatwootParam = await db('account_parameter')
          .select('value')
          .where({ account_id: systemAccountId, name: 'chatwoot-account' })
          .first();
        
        if (!chatwootParam || !chatwootParam.value) {
          console.warn(`Parâmetro 'chatwoot-account' não encontrado para account_id=${systemAccountId}, ignorando...`);
          continue;
        }
        
        const chatwootAccountId = parseInt(chatwootParam.value, 10);
        console.log(`Buscando usuários para chatwootAccountId=${chatwootAccountId} (systemAccountId=${systemAccountId})`);
        
        try {
          const users = await getLoggedUsersDetails(chatwootAccountId, systemAccountId);
          
          // Adicionar metadata de qual conta veio cada usuário
          const usersWithMeta = (users || []).map(u => ({
            ...u,
            chatwootAccountId,
            systemAccountId
          }));
          
          allUsers.push(...usersWithMeta);
          
          accountsInfo.push({
            systemAccountId,
            chatwootAccountId,
            usersCount: users.length
          });
        } catch (userErr) {
          console.error(`Erro ao buscar usuários para chatwootAccountId=${chatwootAccountId}:`, userErr.message);
          // Continua para a próxima conta
        }
      }
      
      // Remover duplicatas por ID (mesmo usuário pode estar em múltiplas contas Chatwoot)
      const uniqueUsers = [];
      const seenIds = new Set();
      
      for (const user of allUsers) {
        if (!seenIds.has(user.id)) {
          seenIds.add(user.id);
          uniqueUsers.push(user);
        }
      }
      
      console.log(`Total de usuários únicos: ${uniqueUsers.length} (de ${allUsers.length} total)`);
      
      return success({
        domain,
        accountsProcessed: accountsInfo.length,
        accountsInfo,
        count: uniqueUsers.length,
        totalCount: allUsers.length,
        data: uniqueUsers,
      });
    }
    // Opção 2: Recebeu accountId diretamente (conta única)
    else if (rawAccountId) {
      const chatwootAccountId = parseInt(rawAccountId, 10);
      if (Number.isNaN(chatwootAccountId)) {
        return error('Parâmetro accountId inválido.', 400);
      }
      
      let systemAccountId;
      
      // Buscar systemAccountId se não foi fornecido
      if (rawSystemAccountId) {
        systemAccountId = parseInt(rawSystemAccountId, 10);
      } else {
        console.log(`systemAccountId não fornecido, buscando via chatwoot-account=${chatwootAccountId}`);
        const accountParam = await db('account_parameter')
          .select('account_id')
          .where({ name: 'chatwoot-account', value: String(chatwootAccountId) })
          .first();
        
        if (!accountParam) {
          return error(`Account não encontrado para chatwoot-account=${chatwootAccountId}`, 404);
        }
        
        systemAccountId = accountParam.account_id;
        console.log(`systemAccountId resolvido: ${systemAccountId}`);
      }
      
      console.log(`Buscando usuários logados para conta Chatwoot: ${chatwootAccountId} (system account ${systemAccountId})`);
      const users = await getLoggedUsersDetails(chatwootAccountId, systemAccountId);

      return success({
        accountId: chatwootAccountId,
        systemAccountId,
        count: Array.isArray(users) ? users.length : 0,
        data: users || [],
      });
    } else {
      return error('Parâmetro accountId ou domain é obrigatório.', 400);
    }
  } catch (err) {
    console.error('Erro no handler get-logged-users:', err);
    return error(err.message || 'Erro interno ao obter usuários logados.', 500);
  }
};
