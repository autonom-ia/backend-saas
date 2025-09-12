/**
 * Mock do serviço de mensagens pendentes para testes unitários
 */

// Dados de mock
const mockAccount = {
  id: '3559a235-c497-4086-afd8-6f04c6f537d6',
  name: 'Empresa Teste',
  product_id: '83678adb-39c4-444c-bfb3-d8955aab5d47',
  conversation_funnel_id: 'aa0126a9-4311-440a-b269-57599917e99c'
};

const mockAccountParameters = {
  'welcome_message': 'Bem-vindo à nossa plataforma!',
  'company_name': 'Autonomia Teste',
  'support_email': 'suporte@autonomia.com'
};

const mockConversationFunnel = {
  id: 'aa0126a9-4311-440a-b269-57599917e99c',
  name: 'Funil de Vendas',
  description: 'Funil padrão para novos leads',
  created_at: '2025-07-01T10:00:00Z'
};

const mockSteps = [
  {
    id: 'bb1126a9-4311-440a-b269-57599917e99c',
    name: 'Qualificação',
    description: 'Etapa inicial de qualificação do lead',
    conversation_funnel_id: 'aa0126a9-4311-440a-b269-57599917e99c',
    created_at: '2025-07-01T10:30:00Z',
    first_step: true,
    assign_to_team: false
  }
];

const mockMessages = {
  'bb1126a9-4311-440a-b269-57599917e99c': [
    {
      id: 'b7d8f59e-43cb-44dc-8f0e-89dbc03f0364',
      conversation_funnel_step_id: 'bb1126a9-4311-440a-b269-57599917e99c',
      content: 'Olá! Notamos que você não interagiu conosco nas últimas horas. Podemos ajudar em algo?',
      shipping_time: 60,
      shipping_order: 1,
      created_at: '2025-07-01T11:00:00Z'
    }
  ]
};

const mockUserSessions = [
  {
    id: '06f98457-3a61-465c-81b0-da4bbb05d5c5',
    conversation_funnel_step_id: 'bb1126a9-4311-440a-b269-57599917e99c',
    last_access: new Date(Date.now() - 120 * 60 * 1000) // 2 horas atrás
  }
];

// Mock da função getPendingMessages
const getPendingMessages = async (accountId) => {
  if (!accountId) {
    throw new Error('ID da conta é obrigatório');
  }

  if (accountId !== mockAccount.id) {
    throw new Error(`Conta não encontrada para o ID: ${accountId}`);
  }

  // Simular mensagens pendentes
  const pendingMessages = [
    {
      conversation_funnel: mockConversationFunnel,
      conversation_funnel_step: mockSteps[0],
      conversation_funnel_step_message: mockMessages[mockSteps[0].id][0],
      user_session: mockUserSessions[0],
      conversation_funnel_register: null
    }
  ];

  return {
    account: mockAccount,
    accountParameters: mockAccountParameters,
    agent_webhook: 'https://webhook.autonomia.com/agent',
    funnel_agent_webhook: 'https://webhook.autonomia.com/funnel-agent',
    messages: pendingMessages
  };
};

// Mock da função getAgentWebhooks
const getAgentWebhooks = async (db, productId) => {
  if (!productId) return { agent_webhook: null, funnel_agent_webhook: null };
  
  if (productId !== mockAccount.product_id) {
    return { agent_webhook: null, funnel_agent_webhook: null };
  }
  
  return {
    agent_webhook: 'https://webhook.autonomia.com/agent',
    funnel_agent_webhook: 'https://webhook.autonomia.com/funnel-agent'
  };
};

// Mock da função registerSentMessage
const registerSentMessage = async (conversationFunnelStepMessageId, userSessionId) => {
  if (!conversationFunnelStepMessageId) {
    throw new Error('ID da mensagem de etapa do funil é obrigatório');
  }
  
  if (!userSessionId) {
    throw new Error('ID da sessão do usuário é obrigatório');
  }
  
  // Validar IDs
  const validMessageId = mockMessages[mockSteps[0].id][0].id;
  const validSessionId = mockUserSessions[0].id;
  
  if (conversationFunnelStepMessageId !== validMessageId) {
    throw new Error(`Mensagem não encontrada com ID: ${conversationFunnelStepMessageId}`);
  }
  
  if (userSessionId !== validSessionId) {
    throw new Error(`Sessão de usuário não encontrada com ID: ${userSessionId}`);
  }
  
  // Simular registro bem-sucedido
  return {
    id: '67890abc-def1-2345-6789-0abcdef12345',
    conversation_funnel_step_message_id: conversationFunnelStepMessageId,
    user_session_id: userSessionId,
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
};

module.exports = {
  getPendingMessages,
  getAgentWebhooks,
  registerSentMessage
};
