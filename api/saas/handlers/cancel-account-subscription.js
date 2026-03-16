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

const getElapsedTime = (startTime) => Date.now() - startTime;

exports.handler = async (event) => {
  const requestStartedAt = Date.now();
  try {
    const accountId = event?.pathParameters?.accountId;
    if (!accountId) {
      return errorResponse({ success: false, message: 'Parâmetro accountId é obrigatório' }, 400, event);
    }

    console.info('[cancel-account-subscription] request started', {
      accountId,
      requestId: event?.requestContext?.requestId || null,
      path: event?.path,
      method: event?.httpMethod || event?.requestContext?.http?.method || null,
    });

    const userContext = await getUserFromEvent(event);
    const userId = userContext?.user?.id;
    if (!userId) {
      console.warn('[cancel-account-subscription] unauthorized request', {
        accountId,
        elapsedMs: getElapsedTime(requestStartedAt),
      });
      return errorResponse({ success: false, message: 'Não autorizado' }, 401, event);
    }

    console.info('[cancel-account-subscription] user resolved', {
      accountId,
      userId,
      elapsedMs: getElapsedTime(requestStartedAt),
    });

    const token = getBearerToken(event);
    if (!token) {
      console.warn('[cancel-account-subscription] missing bearer token', {
        accountId,
        userId,
        elapsedMs: getElapsedTime(requestStartedAt),
      });
      return errorResponse({ success: false, message: 'Token de autorização é obrigatório' }, 401, event);
    }

    const accountLookupStartedAt = Date.now();
    const account = await getAccountById(accountId);
    console.info('[cancel-account-subscription] account loaded', {
      accountId,
      accountName: account?.name || account?.social_name || null,
      elapsedMs: getElapsedTime(accountLookupStartedAt),
      totalElapsedMs: getElapsedTime(requestStartedAt),
    });

    const wahaStartedAt = Date.now();
    console.info('[cancel-account-subscription] starting WAHA cleanup', {
      accountId,
      totalElapsedMs: getElapsedTime(requestStartedAt),
    });
    const wahaResult = await cleanupCancelledAccount({ accountId, token });
    if (!wahaResult) {
      console.error('[cancel-account-subscription] WAHA cleanup returned empty result', {
        accountId,
        elapsedMs: getElapsedTime(wahaStartedAt),
        totalElapsedMs: getElapsedTime(requestStartedAt),
      });
      return errorResponse({ success: false, message: 'Falha ao limpar recursos no WAHA' }, 502, event);
    }

    console.info('[cancel-account-subscription] WAHA cleanup completed', {
      accountId,
      elapsedMs: getElapsedTime(wahaStartedAt),
      totalElapsedMs: getElapsedTime(requestStartedAt),
      wahaResult,
    });

    const softDeleteStartedAt = Date.now();
    await deleteAccount(accountId);
    console.info('[cancel-account-subscription] account soft deleted', {
      accountId,
      elapsedMs: getElapsedTime(softDeleteStartedAt),
      totalElapsedMs: getElapsedTime(requestStartedAt),
    });

    const subscriptionsStartedAt = Date.now();
    const subscriptions = await listAccountSubscriptionsByAccountId(userId, accountId, token);
    console.info('[cancel-account-subscription] subscriptions loaded', {
      accountId,
      subscriptionsCount: subscriptions.length,
      elapsedMs: getElapsedTime(subscriptionsStartedAt),
      totalElapsedMs: getElapsedTime(requestStartedAt),
    });

    const updatedSubscriptions = [];
    const canceledInvoices = [];

    for (const subscription of subscriptions) {
      const subscriptionStartedAt = Date.now();
      console.info('[cancel-account-subscription] processing subscription', {
        accountId,
        subscriptionId: subscription.id,
        totalElapsedMs: getElapsedTime(requestStartedAt),
      });

      const updatedSubscription = await updateAccountSubscription(subscription.id, { isActive: false }, token);
      if (updatedSubscription) {
        updatedSubscriptions.push(updatedSubscription);
      }

      console.info('[cancel-account-subscription] subscription updated', {
        accountId,
        subscriptionId: subscription.id,
        updated: !!updatedSubscription,
        elapsedMs: getElapsedTime(subscriptionStartedAt),
        totalElapsedMs: getElapsedTime(requestStartedAt),
      });

      const invoicesStartedAt = Date.now();
      const invoices = await listInvoicesByAccountSubscriptionId(subscription.id, token);
      const cancellableInvoices = invoices.filter(isInvoicePendingWithoutGatewaySentAt);

      console.info('[cancel-account-subscription] invoices loaded', {
        accountId,
        subscriptionId: subscription.id,
        invoicesCount: invoices.length,
        cancellableInvoicesCount: cancellableInvoices.length,
        elapsedMs: getElapsedTime(invoicesStartedAt),
        totalElapsedMs: getElapsedTime(requestStartedAt),
      });

      for (const invoice of cancellableInvoices) {
        const invoiceStartedAt = Date.now();
        const canceled = await cancelInvoice(invoice.id, token);
        if (canceled) {
          canceledInvoices.push(canceled);
        }

        console.info('[cancel-account-subscription] invoice cancel attempt finished', {
          accountId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          canceled: !!canceled,
          elapsedMs: getElapsedTime(invoiceStartedAt),
          totalElapsedMs: getElapsedTime(requestStartedAt),
        });
      }
    }

    console.info('[cancel-account-subscription] request finished successfully', {
      accountId,
      subscriptionsUpdated: updatedSubscriptions.length,
      invoicesCanceled: canceledInvoices.length,
      totalElapsedMs: getElapsedTime(requestStartedAt),
    });

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
    console.error('[cancel-account-subscription] request failed', {
      error: error?.message || String(error),
      stack: error?.stack || null,
      cause: error?.cause
        ? {
            message: error.cause?.message || String(error.cause),
            code: error.cause?.code || null,
            stack: error.cause?.stack || null,
          }
        : null,
      totalElapsedMs: getElapsedTime(requestStartedAt),
    });
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
