import 'server-only';

import { createAdminClient } from '@/server/database/pocketbase';

const TRIAL_DAYS = 7;
const DEFAULT_TOTAL_BILLING_CYCLES = 120;

function isRecordNotFound(error) {
  return error?.status === 404;
}

function dateFromRecord(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function billingStatusFor(record) {
  if (!record) return null;
  // A legacy record may have been created before the customer approved
  // Razorpay. It is not a real trial and must never consume trial time.
  if (record.status === 'trialing' && !record.razorpay_autopay_accepted) {
    return 'not_started';
  }
  const trialEndsAt = dateFromRecord(record.trial_ends_at);
  if (record.status === 'trialing' && trialEndsAt && trialEndsAt <= new Date()) {
    return 'expired';
  }
  return record.status;
}

function toBillingSummary(record) {
  if (!record) return null;
  return {
    status: billingStatusFor(record),
    trialStartedAt: record.trial_started_at || null,
    trialEndsAt: record.trial_ends_at || null,
    currentPeriodEndsAt: record.current_period_ends_at || null,
    cancelAtPeriodEnd: Boolean(record.cancel_at_period_end),
    subscriptionReady: Boolean(record.razorpay_subscription_id),
    autopayAccepted: Boolean(record.razorpay_autopay_accepted),
  };
}

export async function getBillingSubscription(userId, existingAdminClient) {
  const pb = existingAdminClient || await createAdminClient();
  try {
    return await pb.collection('billing_subscriptions').getFirstListItem(`user = "${userId}"`);
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

export async function startTrialForUser(userId) {
  const existing = await getBillingSubscription(userId);
  if (existing) return existing;

  const pb = await createAdminClient();
  return pb.collection('billing_subscriptions').create({
    user: userId,
    plan: 'starter_monthly',
    status: 'pending_authorisation',
    cancel_at_period_end: false,
    razorpay_autopay_accepted: false,
  });
}

function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;
  if (!keyId || !keySecret || !planId) {
    const error = new Error('Razorpay billing is not configured.');
    error.code = 'BILLING_NOT_CONFIGURED';
    throw error;
  }

  const configuredCycles = Number.parseInt(process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT || '', 10);
  return {
    keyId,
    keySecret,
    planId,
    totalBillingCycles: Number.isInteger(configuredCycles) && configuredCycles > 0
      ? configuredCycles
      : DEFAULT_TOTAL_BILLING_CYCLES,
  };
}

async function razorpayRequest(path, payload, config) {
  const authorization = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.id) {
    console.error('Razorpay request failed.', {
      path,
      status: response.status,
      code: body?.error?.code,
      description: body?.error?.description,
    });
    const error = new Error('Razorpay could not start the subscription.');
    error.code = 'RAZORPAY_SUBSCRIPTION_FAILED';
    error.providerStatus = response.status;
    error.providerCode = body?.error?.code;
    error.providerDescription = body?.error?.description;
    throw error;
  }
  return body;
}

async function getRazorpaySubscription(subscriptionId, config) {
  const authorization = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Basic ${authorization}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.id) {
    console.error('Razorpay subscription lookup failed.', {
      status: response.status,
      code: body?.error?.code,
      description: body?.error?.description,
    });
    const error = new Error('Razorpay could not confirm the subscription.');
    error.providerStatus = response.status;
    error.providerDescription = body?.error?.description;
    throw error;
  }
  return body;
}

function newTrialWindow() {
  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  return {
    trial_started_at: trialStartedAt.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
  };
}

function shouldReplacePendingSubscription(subscription, config) {
  return Boolean(
    subscription?.razorpay_subscription_id
    && subscription.razorpay_plan_id
    && subscription.razorpay_plan_id !== config.planId
    && !subscription.razorpay_autopay_accepted
    && ['pending_authorisation', 'trialing'].includes(subscription.status)
  );
}

async function cancelPendingRazorpaySubscription(subscription, config) {
  const subscriptionId = subscription.razorpay_subscription_id;
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId || '')) {
    const error = new Error('The saved Razorpay subscription ID is invalid.');
    error.code = 'RAZORPAY_SUBSCRIPTION_INVALID';
    throw error;
  }

  try {
    await razorpayRequest(`/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: false }, config);
  } catch (error) {
    // The plan/keys may have moved from Razorpay test mode or another account.
    // This local record is unapproved, so a missing remote subscription is safe
    // to discard before creating the checkout for the current Live account.
    const isMissingFromCurrentAccount = error.providerStatus === 404
      || /ID provided is invalid or could not be found/i.test(error.providerDescription || '');
    if (!isMissingFromCurrentAccount) throw error;

    console.warn('Clearing an unapproved Razorpay checkout missing from the current account.', {
      subscriptionId,
    });
  }

  const pb = await createAdminClient();
  await pb.collection('billing_subscriptions').update(subscription.id, {
    status: 'cancelled',
    cancel_at_period_end: false,
    razorpay_subscription_id: '',
    razorpay_customer_id: '',
    razorpay_plan_id: '',
    current_period_ends_at: '',
    last_payment_id: '',
  });

  return {
    ...subscription,
    status: 'cancelled',
    razorpay_subscription_id: '',
    razorpay_customer_id: '',
    razorpay_plan_id: '',
  };
}

export async function createRazorpaySubscriptionForUser(user) {
  const config = getRazorpayConfig();
  let subscription = await startTrialForUser(user.id);

  // A plan can change while a customer has an unapproved checkout open. Never
  // show that obsolete checkout again. Cancel it before issuing one for the
  // current plan, but never replace an approved or active mandate.
  if (shouldReplacePendingSubscription(subscription, config)) {
    subscription = await cancelPendingRazorpaySubscription(subscription, config);
  }

  // Returning an existing checkout subscription prevents a double-click from
  // creating two Razorpay subscriptions for the same TaskPilot account.
  if (subscription.razorpay_subscription_id && !['cancelled', 'expired'].includes(subscription.status)) {
    return {
      keyId: config.keyId,
      subscriptionId: subscription.razorpay_subscription_id,
      reused: true,
    };
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const activeTrialEndsAt = subscription.razorpay_autopay_accepted
    && billingStatusFor(subscription) === 'trialing'
    ? dateFromRecord(subscription.trial_ends_at)
    : null;
  const plannedTrialEndsAt = activeTrialEndsAt || new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  const startAt = Math.floor(plannedTrialEndsAt.getTime() / 1000);
  const payload = {
    plan_id: config.planId,
    total_count: config.totalBillingCycles,
    quantity: 1,
    customer_notify: false,
    notes: {
      taskpilot_user_id: user.id,
      taskpilot_user_email: user.email,
    },
  };

  // A future start date lets Razorpay schedule the first ₹100 plan charge
  // after the TaskPilot trial. Razorpay shows any required mandate
  // authorisation amount in its own checkout.
  if (startAt && startAt > nowInSeconds + 60) {
    payload.start_at = startAt;
  }

  const razorpaySubscription = await razorpayRequest('/subscriptions', payload, config);
  const pb = await createAdminClient();
  await pb.collection('billing_subscriptions').update(subscription.id, {
    status: subscription.razorpay_autopay_accepted && billingStatusFor(subscription) === 'trialing'
      ? 'trialing'
      : 'pending_authorisation',
    razorpay_subscription_id: razorpaySubscription.id,
    razorpay_plan_id: config.planId,
  });

  return {
    keyId: config.keyId,
    subscriptionId: razorpaySubscription.id,
    reused: false,
  };
}

export async function cancelRazorpaySubscriptionForUser(userId, existingAdminClient) {
  const pb = existingAdminClient || await createAdminClient();
  const subscription = await getBillingSubscription(userId, pb);
  if (!subscription || ['cancelled', 'expired'].includes(subscription.status)) return subscription;

  if (subscription.razorpay_subscription_id) {
    const config = getRazorpayConfig();
    await razorpayRequest(
      `/subscriptions/${subscription.razorpay_subscription_id}/cancel`,
      { cancel_at_cycle_end: false },
      config
    );
  }

  return pb.collection('billing_subscriptions').update(subscription.id, {
    status: 'cancelled',
    cancel_at_period_end: false,
    razorpay_autopay_accepted: false,
  });
}

export async function getBillingSummaryForUser(userId, existingAdminClient) {
  let subscription = await getBillingSubscription(userId, existingAdminClient);

  // Razorpay can complete the mandate before its webhook arrives. During that
  // brief pending state, check Razorpay directly so the customer never gets
  // stuck on a completed checkout. The response is fetched server-side with
  // the secret key; the browser cannot mark a payment as approved.
  if (subscription?.razorpay_subscription_id && !subscription.razorpay_autopay_accepted) {
    try {
      const razorpaySubscription = await getRazorpaySubscription(
        subscription.razorpay_subscription_id,
        getRazorpayConfig()
      );
      if (['authenticated', 'active'].includes(razorpaySubscription.status)) {
        const pb = existingAdminClient || await createAdminClient();
        const isInTrial = razorpaySubscription.status === 'authenticated';
        const update = {
          status: isInTrial ? 'trialing' : 'active',
          razorpay_autopay_accepted: true,
          razorpay_customer_id: razorpaySubscription.customer_id || '',
          razorpay_plan_id: razorpaySubscription.plan_id || '',
        };
        if (isInTrial) Object.assign(update, newTrialWindow());
        subscription = await pb.collection('billing_subscriptions').update(subscription.id, update);
      }
    } catch (error) {
      // Keep the pending checkout visible if Razorpay is temporarily delayed.
      // The signed webhook will also update the record when it arrives.
      console.warn('Pending Razorpay subscription could not be confirmed yet.', {
        status: error.providerStatus,
      });
    }
  }

  return toBillingSummary(subscription);
}
