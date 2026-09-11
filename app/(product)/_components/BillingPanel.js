'use client';

import Link from 'next/link';
import styles from '../dashboard/dashboard.module.css';

function daysRemaining(trialEndsAt) {
  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

export default function BillingPanel({ billing }) {
  const status = billing?.status || 'not_started';
  const trialDays = daysRemaining(billing?.trialEndsAt);
  const isActive = status === 'active';
  const isTrial = status === 'trialing';
  const title = isActive
    ? 'Your plan is active.'
    : isTrial
      ? 'Your 7-day free trial is active.'
      : 'Your free trial has not started.';
  const detail = isActive
    ? 'Your INR 100/month subscription is active.'
    : isTrial
      ? `${trialDays === 0 ? 'Your trial ends today.' : `${trialDays ?? 7} day${trialDays === 1 ? '' : 's'} left in your free trial.`} No INR 100 charge happens before the trial ends.`
      : 'Connect Taiga to start your 7-day free trial. Razorpay approval happens only after you complete the Taiga form.';

  return (
    <article className={styles.billingPanel}>
      <div className={styles.billingHeading}>
        <div><p className={styles.eyebrow}>Billing</p><h2>{title}</h2></div>
        <span className={isActive ? styles.billingActive : styles.billingTrial}>{isActive ? 'Active' : isTrial ? 'Free trial' : 'Not started'}</span>
      </div>
      <p>{detail}</p>
      {!isActive && <Link href="/onboard/taiga" className={styles.billingButton}>{isTrial ? 'Manage Taiga connection' : 'Start your free trial'}</Link>}
      {!isActive && <small className={styles.billingNote}>You will review the INR 100/month recurring-payment approval in Razorpay after completing your Taiga details.</small>}
    </article>
  );
}
