const { success, error: errorResponse } = require('../utils/response');
const { getUserFromEvent } = require('../utils/auth-user');
const { getAccountById, deleteAccount } = require('../services/account-service');
const {
  listAccountSubscriptionsByAccountId,
  updateAccountSubscription,
  listInvoicesByAccountSubscriptionId,
  cancelInvoice,
} = require('../services/financial-service-client');
const { cleanupCancelledAccount } = require('../services/waha-service-client');

const getBearerToken = (event) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
};

const isInvoicePendingWithoutGatewaySentAt = (invoice) => {
  const status = String(invoice?.status || '').toLowerCase();
  const gatewaySentAt = invoice?.gatewaySentAt ?? invoice?.gateway_sent_at ?? null;
  return status === 'pending' && gatewaySentAt == null;
};

exports.handler = async (event) => {
  try {
    const accountId = event?.pathParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400, event);
    }

    const userContext = await getUserFromEvent(event);
    const userId = userContext?.user?.id;
    if (!userId) {
      return errorResponse({ success: false, message: 'Não autorizado' }, 401, event);
    }

    const token = getBearerToken(event);
    if (!token) {
      return errorResponse({ success: false, message: 'Token de autorização é obrigatório' }, 401, event);
    }

    const account = await getAccountById(accountId);

    const wahaResult = await cleanupCancelledAccount({ accountId, token });
    if (!wahaResult) {
      return errorResponse({ success: false, message: 'Falha ao limpar recursos no WAHA' }, 502, event);
    }

    await deleteAccount(accountId);

    const subscriptions = await listAccountSubscriptionsByAccountId(userId, accountId, token);
    const updatedSubscriptions = [];
    const canceledInvoices = [];

    for (const subscription of subscriptions) {
      const updatedSubscription = await updateAccountSubscription(subscription.id, { isActive: false }, token);
      if (updatedSubscription) {
        updatedSubscriptions.push(updatedSubscription);
      }

      const invoices = await listInvoicesByAccountSubscriptionId(subscription.id, token);
      const cancellableInvoices = invoices.filter(isInvoicePendingWithoutGatewaySentAt);

      for (const invoice of cancellableInvoices) {
        const canceled = await cancelInvoice(invoice.id, token);
        if (canceled) {
          canceledInvoices.push(canceled);
        }
      }
    }

    return success(
      {
        success: true,
        message: 'Assinatura cancelada com sucesso',
        data: {
          accountId,
          accountName: account.name || account.social_name || null,
          subscriptionsUpdated: updatedSubscriptions.length,
          invoicesCanceled: canceledInvoices.length,
          waha: wahaResult,
        },
      },
      200,
      event
    );
  } catch (error) {
    console.error('Erro ao cancelar assinatura da conta:', error);
    if (error?.message === 'Conta não encontrada') {
      return errorResponse({ success: false, message: error.message }, 404, event);
    }
    return errorResponse(
      {
        success: false,
        message: 'Erro ao cancelar assinatura da conta',
        error: error?.message || String(error),
      },
      500,
      event
    );
  }
};
