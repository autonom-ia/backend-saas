/**
 * Serviço para desalocar contatos inativos dos atendentes do Chatwoot
 */
const { getDbConnection, closeDbConnection } = require('../utils/database');
const {
  createChatwootDbConnection: createConfiguredChatwootDbConnection,
  getAccountIdByPrefix,
  normalizePrefix,
} = require('../utils/chatwoot-database');
// Removido uso de SSM. Os parâmetros agora são obtidos da tabela account_parameter e valores fixos

/**
 * Busca parâmetros de prefixo para todas as contas
 * @returns {Promise<Array>} - Lista de parâmetros de prefixo
 */
const getPrefixParameters = async () => {
  const db = getDbConnection();
  try {
    // Buscar todos os parâmetros com nome "prefix-parameter"
    const prefixParams = await db('account_parameter')
      .select('account_id', 'name', 'value')
      .where('name', 'prefix-parameter');
    
    return prefixParams;
  } catch (error) {
    console.error('Erro ao buscar parâmetros de prefixo:', error);
    throw new Error(`Erro ao buscar parâmetros de prefixo: ${error.message}`);
  }
};


/**
 * Cria uma conexão com o banco de dados do Chatwoot usando a conta mapeada por prefix-parameter.
 */
const createChatwootDbConnection = async (prefix) => {
  try {
    const db = getDbConnection();
    const normalizedPrefix = normalizePrefix(prefix);
    console.log(`Buscando host do Chatwoot para prefixo: ${normalizedPrefix}`);

    const accountId = await getAccountIdByPrefix(db, normalizedPrefix);
    const chatwootDb = await createConfiguredChatwootDbConnection(db, {
      accountId,
      poolMax: 1,
    });

    console.log('Conexão com o banco Chatwoot estabelecida com sucesso!');
    return chatwootDb;
  } catch (error) {
    console.error(`Erro ao criar conexão com banco de dados do Chatwoot (prefixo: ${prefix}):`, error);
    throw new Error(`Erro ao criar conexão com banco de dados do Chatwoot: ${error.message}`);
  }
};

/**
 * Busca o tempo de expiração em horas para desalocação de contatos inativos
 * @param {string} accountId - ID da conta (UUID)
 * @returns {Promise<number>} - Tempo de expiração em horas
 */
const getExpirationHours = async (accountId) => {
  try {
    console.log(`Buscando tempo de expiração para a conta ID: ${accountId}`);
    
    // Obter a conexão com o banco de dados principal
    const db = getDbConnection();
    
    // Buscar o parâmetro expiration-unassigned-hours na tabela account_parameter
    const expirationParam = await db('account_parameter')
      .select('value')
      .where({
        account_id: accountId,
        name: 'expiration-unassigned-hours'
      })
      .first();
    
    if (expirationParam) {
      const expirationHours = parseInt(expirationParam.value, 10);
      console.log(`Valor de horas de expiração para a conta ${accountId}: ${expirationHours}`);
      return expirationHours;
    } else {
      // Se não encontrar o parâmetro, usar valor padrão de 99999 horas
      console.log(`Parâmetro expiration-unassigned-hours não encontrado para a conta ${accountId}, usando valor padrão de 99999 horas`);
      return 99999;
    }
  } catch (error) {
    console.error(`Erro ao buscar horas de expiração para a conta ${accountId}:`, error);
    // Em caso de erro, usar valor padrão de 99999 horas
    return 99999;
  }
};

/**
 * Busca contatos inativos para desalocar
 * @param {Object} chatwootDb - Conexão com o banco de dados do Chatwoot
 * @param {number} expirationHours - Valor de horas de expiração
 * @returns {Promise<Array>} - Lista de contatos inativos
 */
const findInactiveContacts = async (chatwootDb, expirationHours) => {
  try {
    // Buscar contatos inativos
    const inactiveContacts = await chatwootDb.raw(`
      select u.name as agent_name, c2.name as contact_name, c2.phone_number, c.id
      from conversations c
      join users u on u.id = c.assignee_id
      join contacts c2 on c2.id = c.contact_id
      where c.assignee_id is not null 
      and c.last_activity_at < current_timestamp - interval '${expirationHours} hours'
      limit 100
    `);
    
    return inactiveContacts.rows;
  } catch (error) {
    console.error('Erro ao buscar contatos inativos:', error);
    throw new Error(`Erro ao buscar contatos inativos: ${error.message}`);
  }
};

/**
 * Desaloca um contato inativo
 * @param {Object} chatwootDb - Conexão com o banco de dados do Chatwoot
 * @param {number} conversationId - ID da conversa
 * @param {string} contactName - Nome do contato
 * @returns {Promise<void>}
 */
const unassignContact = async (chatwootDb, conversationId, contactName) => {
  try {
    // Desalocar contato
    await chatwootDb('conversations')
      .where('id', conversationId)
      .update({ assignee_id: null, status: '1' });
    
    console.log(`Contact ${contactName} unassigned`);
  } catch (error) {
    console.error(`Erro ao desalocar contato ${contactName}:`, error);
    throw new Error(`Erro ao desalocar contato ${contactName}: ${error.message}`);
  }
};

/**
 * Desaloca contatos inativos para todas as contas
 * @returns {Promise<Object>} - Resultado da operação
 */
const unassignInactiveContacts = async () => {
  try {
    // Buscar parâmetros de prefixo
    const prefixParams = await getPrefixParameters();
    
    if (!prefixParams || prefixParams.length === 0) {
      console.log('Nenhum parâmetro de prefixo encontrado');
      return { unassignedCount: 0, accounts: [] };
    }
    
    const result = {
      unassignedCount: 0,
      accounts: []
    };
    
    // Processar cada conta
    for (const prefixParam of prefixParams) {
      const accountId = prefixParam.account_id;
      const prefix = prefixParam.value;
      
      console.log(`Processando conta ${accountId} com prefixo ${prefix}`);
      
      try {
        // Criar conexão com o banco de dados do Chatwoot
        const chatwootDb = await createChatwootDbConnection(prefix);
        
        // Buscar o valor de horas de expiração usando o accountId
        const expirationHours = await getExpirationHours(accountId);
        
        // Buscar contatos inativos
        const inactiveContacts = await findInactiveContacts(chatwootDb, expirationHours);
        
        const accountResult = {
          accountId,
          prefix,
          unassignedCount: 0,
          contacts: []
        };
        
        // Desalocar cada contato inativo
        for (const contact of inactiveContacts) {
          await unassignContact(chatwootDb, contact.id, contact.contact_name);
          
          accountResult.unassignedCount++;
          result.unassignedCount++;
          
          accountResult.contacts.push({
            contactName: contact.contact_name,
            agentName: contact.agent_name,
            phoneNumber: contact.phone_number,
            conversationId: contact.id
          });
        }
        
        result.accounts.push(accountResult);
        
        // Fechar conexão com o banco de dados do Chatwoot
        await chatwootDb.destroy();
      } catch (error) {
        console.error(`Erro ao processar conta ${accountId}:`, error);
        result.accounts.push({
          accountId,
          prefix,
          error: error.message,
          unassignedCount: 0,
          contacts: []
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Erro ao desalocar contatos inativos:', error);
    throw new Error(`Erro ao desalocar contatos inativos: ${error.message}`);
  } finally {
    // Garantir que a conexão com o banco seja fechada
    await closeDbConnection();
  }
};

module.exports = {
  unassignInactiveContacts,
  getExpirationHours
};
