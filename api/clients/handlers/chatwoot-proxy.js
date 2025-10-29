/**
 * Chatwoot Proxy Handler
 * Proxies requests to Chatwoot API to avoid CORS issues
 */

const { getDbConnection } = require('../utils/database');

/**
 * Get account parameters (chatwoot-url, chatwoot-token, chatwoot-account)
 */
async function getAccountChatwootConfig(accountId) {
  const db = getDbConnection();
  const params = await db('account_parameter')
    .where({ account_id: accountId })
    .whereIn('name', ['chatwoot-url', 'chatwoot-token', 'chatwoot-account'])
    .select('name', 'value');

  const config = {
    url: null,
    token: null,
    accountId: null
  };

  params.forEach(p => {
    if (p.name === 'chatwoot-url') config.url = p.value;
    if (p.name === 'chatwoot-token') config.token = p.value;
    if (p.name === 'chatwoot-account') config.accountId = p.value;
  });

  return config;
}

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('[ChatwootProxy] Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { accountId, action, conversationId } = event.queryStringParameters || {};

    console.log('[ChatwootProxy] Query params:', { accountId, action, conversationId });

    if (!accountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'accountId is required' })
      };
    }

    // Get Chatwoot config from account parameters
    console.log('[ChatwootProxy] Fetching config for account:', accountId);
    const config = await getAccountChatwootConfig(accountId);
    console.log('[ChatwootProxy] Config loaded:', { 
      hasUrl: !!config.url, 
      hasToken: !!config.token, 
      hasAccountId: !!config.accountId 
    });

    if (!config.url || !config.token || !config.accountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Chatwoot not configured for this account',
          missing: {
            url: !config.url,
            token: !config.token,
            accountId: !config.accountId
          }
        })
      };
    }

    const baseUrl = config.url.replace(/\/$/, '');
    const chatwootHeaders = {
      'api_access_token': config.token,
      'Content-Type': 'application/json'
    };

    let response;

    switch (action) {
      // GET conversation
      case 'getConversation':
        if (!conversationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'conversationId is required' })
          };
        }

        response = await fetch(
          `${baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}`,
          { headers: chatwootHeaders }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({ error: errorText, status: response.status })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(await response.json())
        };

      // GET messages
      case 'getMessages':
        if (!conversationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'conversationId is required' })
          };
        }

        response = await fetch(
          `${baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
          { headers: chatwootHeaders }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({ error: errorText, status: response.status })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(await response.json())
        };

      // POST send message
      case 'sendMessage':
        if (!conversationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'conversationId is required' })
          };
        }

        const messageBody = JSON.parse(event.body || '{}');
        
        response = await fetch(
          `${baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers: chatwootHeaders,
            body: JSON.stringify(messageBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({ error: errorText, status: response.status })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(await response.json())
        };

      // PUT update conversation status
      case 'updateStatus':
        if (!conversationId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'conversationId is required' })
          };
        }

        const statusBody = JSON.parse(event.body || '{}');
        
        response = await fetch(
          `${baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}`,
          {
            method: 'PUT',
            headers: chatwootHeaders,
            body: JSON.stringify(statusBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({ error: errorText, status: response.status })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(await response.json())
        };

      // GET conversations list
      case 'getConversations':
        const { status = 'all' } = event.queryStringParameters || {};
        
        response = await fetch(
          `${baseUrl}/api/v1/accounts/${config.accountId}/conversations?status=${status}`,
          { headers: chatwootHeaders }
        );

        if (!response.ok) {
          const errorText = await response.text();
          return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({ error: errorText, status: response.status })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(await response.json())
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Invalid action',
            validActions: ['getConversation', 'getMessages', 'sendMessage', 'updateStatus', 'getConversations']
          })
        };
    }

  } catch (error) {
    console.error('[ChatwootProxy] Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
