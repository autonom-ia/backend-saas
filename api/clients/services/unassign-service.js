/**
 * Serviço para desalocar contatos inativos dos atendentes do Chatwoot
 */
const { getDbConnection, closeDbConnection } = require('../utils/database');
const knex = require('knex');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

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
 * Busca parâmetros do AWS SSM Parameter Store
 * @param {string} paramPath - Caminho do parâmetro no SSM
 * @returns {Promise<string>} - Valor do parâmetro
 */
const getSSMParameter = async (paramPath) => {
  console.log(`Iniciando busca do parâmetro SSM: ${paramPath}`);
  try {
    const command = new GetParameterCommand({
      Name: paramPath,
      WithDecryption: true
    });
    
    // Adicionar timeout à chamada SSM
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout ao buscar parâmetro ${paramPath} após 5 segundos`));
      }, 5000);
    });
    
    // Corrida entre a chamada SSM e o timeout
    const response = await Promise.race([
      ssmClient.send(command),
      timeoutPromise
    ]);
    
    console.log(`Parâmetro ${paramPath} obtido com sucesso`);
    return response.Parameter.Value;
  } catch (error) {
    console.error(`Erro ao buscar parâmetro ${paramPath}:`, error.message);
    throw new Error(`Erro no parâmetro: ${paramPath} - ${error.message}`);
  }
};

/**
 * Cria uma conexão com o banco de dados do Chatwoot usando o prefixo
 * @param {string} prefix - Prefixo para os parâmetros do banco
 * @returns {Object} - Conexão com o banco de dados
 */
const createChatwootDbConnection = async (prefix) => {
  try {
    console.log(`Buscando parâmetros de conexão para prefixo: ${prefix}`);
    
    // Extrair o prefixo para as variáveis de ambiente
    // Remove a barra no início e no final e converte para maiúsculas
    const envPrefix = prefix.replace(/^\/|\/$/g, '').split('/')[0].toUpperCase();
    console.log(`Prefixo de ambiente calculado: ${envPrefix}`);
    
    // Construir os nomes das variáveis de ambiente com base no prefixo
    const hostVarName = `${envPrefix}_CHATWOOT_DB_HOST`;
    const nameVarName = `${envPrefix}_CHATWOOT_DB_NAME`;
    const passwordVarName = `${envPrefix}_CHATWOOT_DB_PASSWORD`;
    const portVarName = `${envPrefix}_CHATWOOT_DB_PORT`;
    const userVarName = `${envPrefix}_CHATWOOT_DB_USER`;
    
    console.log(`Buscando variáveis de ambiente:`);
    console.log(`- ${hostVarName}`);
    console.log(`- ${nameVarName}`);
    console.log(`- ${passwordVarName}`);
    console.log(`- ${portVarName}`);
    console.log(`- ${userVarName}`);
    
    // Buscar parâmetros das variáveis de ambiente
    const host = process.env[hostVarName];
    const name = process.env[nameVarName];
    const password = process.env[passwordVarName];
    const port = process.env[portVarName];
    const user = process.env[userVarName];
    
    // Verificar se todos os parâmetros necessários estão presentes
    const missingEnvVars = [];
    if (!host) missingEnvVars.push(hostVarName);
    if (!name) missingEnvVars.push(nameVarName);
    if (!password) missingEnvVars.push(passwordVarName);
    if (!port) missingEnvVars.push(portVarName);
    if (!user) missingEnvVars.push(userVarName);
    
    if (missingEnvVars.length > 0) {
      throw new Error(`Variáveis de ambiente não encontradas: ${missingEnvVars.join(', ')}`);
    }

    
    // Log dos parâmetros de conexão (exceto senha)
    console.log(`Parâmetros de conexão para Chatwoot (prefixo ${prefix}):`);
    console.log(`- Host: ${host}`);
    console.log(`- Database: ${name}`);
    console.log(`- Port: ${port}`);
    console.log(`- User: ${user}`);
    console.log('- Password: [REDACTED]');
    
    // Criar conexão com o banco de dados do Chatwoot
    console.log(`Tentando conectar ao banco Chatwoot: ${host}:${port}/${name} como ${user}`);
    const chatwootDb = knex({
      client: 'pg',
      connection: {
        host,
        port,
        user,
        password,
        database: name
      },
      pool: { min: 0, max: 1 },
      acquireConnectionTimeout: 10000 // 10 segundos para timeout de conexão
    });
    
    // Testar conexão com uma consulta simples
    console.log('Testando conexão com o banco Chatwoot...');
    await chatwootDb.raw('SELECT 1');
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
      // Se não encontrar o parâmetro, usar valor padrão de 72 horas
      console.log(`Parâmetro expiration-unassigned-hours não encontrado para a conta ${accountId}, usando valor padrão de 72 horas`);
      return 72;
    }
  } catch (error) {
    console.error(`Erro ao buscar horas de expiração para a conta ${accountId}:`, error);
    // Em caso de erro, usar valor padrão de 72 horas
    return 72;
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
