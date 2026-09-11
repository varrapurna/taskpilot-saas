'use client';

import { useState } from 'react';
import styles from '../dashboard/dashboard.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-taskpilot-razorpay]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Razorpay), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Razorpay checkout could not load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.taskpilotRazorpay = 'true';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Razorpay checkout could not load.'));
    document.body.appendChild(script);
  });
}

function daysRemaining(trialEndsAt) {
  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

export default function BillingPanel({ billing }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const status = billing?.status || 'trialing';
  const trialDays = daysRemaining(billing?.trialEndsAt);
  const isActive = status === 'active';
  const isTrial = status === 'trialing';
  const title = isActive ? 'Your plan is active.' : isTrial ? 'Your 7-day free trial is active.' : 'Continue with TaskPilot.';
  const detail = isActive
    ? 'Your ₹100/month subscription is active.'
    : isTrial
      ? `${trialDays === 0 ? 'Your trial ends today.' : `${trialDays ?? 7} day${trialDays === 1 ? '' : 's'} left in your free trial.`} No ₹100 charge happens before the trial ends.`
      : 'Set up automatic billing to continue using TaskPilot after your free trial.';

  async function beginSubscription() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/subscription`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not start billing.');

      const Razorpay = await loadRazorpayCheckout();
      if (!Razorpay) throw new Error('Razorpay checkout could not load.');
      const checkout = new Razorpay({
        key: body.checkout.keyId,
        subscription_id: body.checkout.subscriptionId,
        name: 'TaskPilot',
        description: '₹100/month after your free trial',
        recurring: true,
        handler: () => {
          setMessage('Authorisation received. Your plan will update after Razorpay confirms it.');
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      checkout.open();
    } catch (error) {
      setMessage(error.message || 'We could not start billing.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className={styles.billingPanel}>
      <div className={styles.billingHeading}>
        <div><p className={styles.eyebrow}>Billing</p><h2>{title}</h2></div>
        <span className={isActive ? styles.billingActive : styles.billingTrial}>{isActive ? 'Active' : isTrial ? 'Free trial' : 'Payment setup'}</span>
      </div>
      <p>{detail}</p>
      {!isActive && <button className={styles.billingButton} type="button" onClick={beginSubscription} disabled={loading}>{loading ? 'Opening secure checkout…' : billing?.subscriptionReady ? 'Continue payment setup' : 'Set up ₹100/month plan'}</button>}
      <small className={styles.billingNote}>Payment is securely handled by Razorpay. Any recurring-payment authorisation is shown by Razorpay before you continue.</small>
      {message && <p className={styles.billingMessage} role="status">{message}</p>}
    </article>
  );
}
