import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/server/database/pocketbase';

const TRIAL_DAYS = 7;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '', 'utf8');
  const rightBuffer = Buffer.from(right || '', 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function dateFromUnixTimestamp(value) {
  if (!Number.isInteger(value) || value <= 0) return undefined;
  return new Date(value * 1000).toISOString();
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function eventDetails(eventType, payload) {
  const payment = payload?.payment?.entity;
  const invoice = payload?.invoice?.entity;
  const occurredAt = dateFromUnixTimestamp(payment?.captured_at)
    || dateFromUnixTimestamp(payment?.created_at)
    || dateFromUnixTimestamp(invoice?.paid_at)
    || dateFromUnixTimestamp(invoice?.created_at)
    || new Date().toISOString();
  const amount = payment?.amount ?? invoice?.amount_paid ?? invoice?.amount;

  return {
    event_type: eventType || 'unknown',
    event_source: 'webhook',
    payment_id: text(payment?.id, 100),
    invoice_id: text(invoice?.id, 100),
    amount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
    currency: text(payment?.currency || invoice?.currency, 10),
    payment_status: text(payment?.status || invoice?.status || eventType, 50),
    occurred_at: occurredAt,
    failure_reason: text(payment?.error_description || payment?.error_reason || invoice?.description, 500),
  };
}

function hasActiveTrial(billingSubscription) {
  if (billingSubscription?.status !== 'trialing' || !billingSubscription.trial_ends_at) return false;
  const trialEnd = new Date(billingSubscription.trial_ends_at);
  return !Number.isNaN(trialEnd.getTime()) && trialEnd > new Date();
}

function newTrialWindow() {
  const startedAt = new Date();
  const endsAt = new Date(startedAt);
  endsAt.setDate(endsAt.getDate() + TRIAL_DAYS);
  return {
    trial_started_at: startedAt.toISOString(),
    trial_ends_at: endsAt.toISOString(),
  };
}

function getSubscriptionUpdate(eventType, subscription, payment, billingSubscription) {
  const update = {
    razorpay_customer_id: subscription.customer_id || '',
    razorpay_plan_id: subscription.plan_id || '',
  };
  const periodEnd = dateFromUnixTimestamp(subscription.current_end);
  if (periodEnd) update.current_period_ends_at = periodEnd;
  if (payment?.id) update.last_payment_id = payment.id;

  if (eventType === 'subscription.authenticated') {
    // The free trial begins only when Razorpay confirms auto-pay approval.
    update.status = billingSubscription?.trial_started_at ? 'active' : 'trialing';
    update.razorpay_autopay_accepted = true;
    if (!billingSubscription?.trial_started_at && (!billingSubscription?.razorpay_autopay_accepted || !hasActiveTrial(billingSubscription))) {
      Object.assign(update, newTrialWindow());
    }
  } else if (eventType === 'subscription.activated' || eventType === 'subscription.charged') {
    update.status = 'active';
    update.razorpay_autopay_accepted = true;
  } else if (eventType === 'subscription.pending' || eventType === 'subscription.halted') {
    update.status = 'past_due';
  } else if (eventType === 'subscription.cancelled') {
    update.status = 'cancelled';
    update.cancel_at_period_end = false;
    update.razorpay_autopay_accepted = false;
    update.cancelled_at = dateFromUnixTimestamp(subscription.ended_at) || new Date().toISOString();
  } else if (eventType === 'subscription.completed') {
    update.status = 'expired';
    update.razorpay_autopay_accepted = false;
  }

  return update;
}

export function verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  if (!rawBody || !signature || !webhookSecret) return false;
  const expectedSignature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expectedSignature, signature);
}

export async function processRazorpayWebhook({ eventId, eventType, payload }) {
  if (!eventId || eventId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(eventId)) {
    throw new Error('Invalid Razorpay event ID.');
  }

  const pb = await createAdminClient();
  try {
    await pb.collection('billing_webhook_events').getFirstListItem(`event_id = "${eventId}"`);
    return { duplicate: true };
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  const subscription = payload?.subscription?.entity;
  const payment = payload?.payment?.entity;
  if (!subscription?.id || !/^sub_[A-Za-z0-9]+$/.test(subscription.id)) {
    await pb.collection('billing_webhook_events').create({
      event_id: eventId,
      processed_at: new Date().toISOString(),
      ...eventDetails(eventType, payload),
    });
    return { ignored: true };
  }

  let billingSubscription = null;
  try {
    billingSubscription = await pb.collection('billing_subscriptions').getFirstListItem(`razorpay_subscription_id = "${subscription.id}"`);
    await pb.collection('billing_subscriptions').update(
      billingSubscription.id,
      getSubscriptionUpdate(eventType, subscription, payment, billingSubscription)
    );
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  const eventRecord = {
    event_id: eventId,
    processed_at: new Date().toISOString(),
    ...eventDetails(eventType, payload),
  };
  if (billingSubscription) eventRecord.subscription = billingSubscription.id;
  await pb.collection('billing_webhook_events').create(eventRecord);
  return { updated: Boolean(billingSubscription) };
}
