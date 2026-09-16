import 'server-only';

import { createAdminClient } from '@/server/database/pocketbase';

function pocketBaseDate(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function toUserSummary(record) {
  return {
    id: record.id,
    name: record.name || 'Unnamed user',
    email: record.email,
    role: record.role === 'admin' ? 'admin' : 'user',
    verified: Boolean(record.verified),
    created: record.created,
    lastLoginAt: record.last_login_at || null,
  };
}

function dateValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function paymentKey(record) {
  return record.invoice_id || record.payment_id || record.event_id || record.id;
}

function paidPayment(record) {
  const status = String(record.payment_status || '').toLowerCase();
  return (record.event_type === 'subscription.charged' || record.event_type === 'invoice.paid')
    && ['paid', 'captured'].includes(status)
    && Number(record.amount) > 0;
}

function toPaymentSummary(record, usersById, subscriptionsById) {
  const subscription = subscriptionsById.get(record.subscription);
  const user = subscription ? usersById.get(subscription.user) : null;
  return {
    id: record.id,
    userId: subscription?.user || null,
    eventType: record.event_type || 'unknown',
    status: record.payment_status || 'recorded',
    amount: Number(record.amount || 0),
    currency: record.currency || 'INR',
    occurredAt: record.occurred_at || record.processed_at || record.created,
    failureReason: record.failure_reason || null,
    userName: user?.name || 'Unknown user',
    userEmail: user?.email || 'Unavailable',
  };
}

function toSubscriptionSummary(record, usersById, eventsBySubscription) {
  const user = usersById.get(record.user);
  const events = eventsBySubscription.get(record.id) || [];
  const latestPayment = events.find(paidPayment) || null;
  return {
    id: record.id,
    userName: user?.name || 'Unknown user',
    userEmail: user?.email || 'Unavailable',
    status: record.status || 'not_started',
    autopayAccepted: Boolean(record.razorpay_autopay_accepted),
    cancelAtPeriodEnd: Boolean(record.cancel_at_period_end),
    trialEndsAt: record.trial_ends_at || null,
    currentPeriodEndsAt: record.current_period_ends_at || null,
    cancelledAt: record.cancelled_at || null,
    lastPayment: latestPayment ? {
      amount: Number(latestPayment.amount || 0),
      currency: latestPayment.currency || 'INR',
      occurredAt: latestPayment.occurred_at || latestPayment.processed_at || latestPayment.created,
    } : null,
  };
}

export async function getAdminOverview() {
  const pb = await createAdminClient();
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(now.getDate() - 30);

  // PocketBase automatically cancels matching requests from the same client.
  // These list queries all target the users collection, so run them in order
  // instead of using Promise.all. This keeps every metric reliable.
  const allUsers = await pb.collection('users').getList(1, 1);
  const verifiedUsers = await pb.collection('users').getList(1, 1, { filter: 'verified = true' });
  const newUsers = await pb.collection('users').getList(1, 1, {
    filter: `created >= "${pocketBaseDate(weekAgo)}"`,
  });
  const activeUsers = await pb.collection('users').getList(1, 1, {
    filter: `last_login_at >= "${pocketBaseDate(monthAgo)}"`,
  });
  const recentUsers = await pb.collection('users').getList(1, 25, { sort: '-created' });
  // Older PocketBase billing collections can reject server-side sorting on
  // system or newly added fields. Fetch the private records plainly and sort
  // them below in JavaScript, so the admin dashboard stays available during
  // and after a billing schema rollout.
  const billingSubscriptions = await pb.collection('billing_subscriptions').getFullList();
  const billingEvents = await pb.collection('billing_webhook_events').getFullList();
  const usersById = new Map((await pb.collection('users').getFullList()).map((user) => [user.id, user]));
  const subscriptionsById = new Map(billingSubscriptions.map((subscription) => [subscription.id, subscription]));
  const eventsBySubscription = new Map();
  for (const event of billingEvents) {
    if (!event.subscription) continue;
    const events = eventsBySubscription.get(event.subscription) || [];
    events.push(event);
    eventsBySubscription.set(event.subscription, events);
  }

  const uniquePayments = new Map();
  for (const event of billingEvents) {
    if (!paidPayment(event)) continue;
    const key = paymentKey(event);
    const existing = uniquePayments.get(key);
    if (!existing || dateValue(event.occurred_at || event.created) > dateValue(existing.occurred_at || existing.created)) {
      uniquePayments.set(key, event);
    }
  }
  const subscriptions = billingSubscriptions
    .slice()
    .sort((left, right) => dateValue(right.updated || right.created) - dateValue(left.updated || left.created))
    .map((subscription) => toSubscriptionSummary(subscription, usersById, eventsBySubscription));
  const history = billingEvents
    .slice()
    .sort((left, right) => dateValue(right.occurred_at || right.created) - dateValue(left.occurred_at || left.created))
    .map((event) => toPaymentSummary(event, usersById, subscriptionsById));

  return {
    metrics: {
      totalUsers: allUsers.totalItems,
      verifiedUsers: verifiedUsers.totalItems,
      newUsersThisWeek: newUsers.totalItems,
      activeUsersLast30Days: activeUsers.totalItems,
    },
    users: recentUsers.items.map(toUserSummary),
    billing: {
      metrics: {
        activeAutopay: subscriptions.filter((subscription) => subscription.autopayAccepted && ['trialing', 'active'].includes(subscription.status)).length,
        cancellingAtCycleEnd: subscriptions.filter((subscription) => subscription.cancelAtPeriodEnd).length,
        failedPayments: billingEvents.filter((event) => ['failed', 'past_due'].includes(String(event.payment_status || '').toLowerCase())).length,
        totalCollected: [...uniquePayments.values()].reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      },
      subscriptions,
      history,
      hasSubscriptions: billingSubscriptions.length > 0,
    },
  };
}
