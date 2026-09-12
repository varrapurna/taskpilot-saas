'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '../../../_components/SignOutButton';
import styles from '../../onboard.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const TAIGA_BASE_URL = 'https://api.taiga.io/api/v1';

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

export default function TaigaOnboardForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: '',
    taigaUsername: '',
    taigaPassword: '',
  });
  const [billing, setBilling] = useState(null);
  const [billingError, setBillingError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function loadBilling() {
    const response = await fetch(`${API_BASE_URL}/api/billing/status`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'We could not check billing.');
    setBilling(body.billing || null);
    return body.billing || null;
  }

  useEffect(() => {
    let active = true;
    loadBilling().catch((requestError) => {
      if (active) setBillingError(requestError.message || 'We could not check billing.');
    });
    return () => { active = false; };
  }, []);

  function handleChange(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }

  async function submitTaiga() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, taigaBaseUrl: TAIGA_BASE_URL }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Something went wrong.');
      router.push('/dashboard');
    } catch (requestError) {
      setError(requestError.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function waitForApproval() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const latestBilling = await loadBilling();
        if (latestBilling?.autopayAccepted) {
          setPaymentMessage('Your free trial is active. Connecting Taiga securely...');
          setPaymentLoading(false);
          await submitTaiga();
          return;
        }
      } catch {
        // Keep checking while Razorpay delivers the verified webhook.
      }
    }
    setPaymentMessage('Razorpay approval is still being confirmed. Please refresh this page in a moment.');
    setPaymentLoading(false);
  }

  async function beginAutopay() {
    setPaymentLoading(true);
    setPaymentMessage('');
    setBillingError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/subscription`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not start your free trial.');

      const Razorpay = await loadRazorpayCheckout();
      if (!Razorpay) throw new Error('Razorpay checkout could not load.');
      const checkout = new Razorpay({
        key: body.checkout.keyId,
        subscription_id: body.checkout.subscriptionId,
        name: 'TaskPilot',
        description: '7-day free trial. ₹5 refundable mandate verification now; ₹100/month afterward.',
        recurring: true,
        redirect: false,
        theme: { color: '#14281a', backdrop_color: '#14281a' },
        modal: {
          backdropclose: false,
          confirm_close: true,
          handleback: false,
          ondismiss: () => setPaymentLoading(false),
        },
        handler: () => {
          setPaymentMessage('Razorpay approval received. Confirming it securely...');
          waitForApproval();
        },
      });
      checkout.open();
    } catch (requestError) {
      setPaymentMessage(requestError.message || 'We could not start your free trial.');
      setPaymentLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (billing?.autopayAccepted) return submitTaiga();
    return beginAutopay();
  }

  const approved = Boolean(billing?.autopayAccepted);

  return (
    <main className={styles.setupMain}>
      <header className={styles.setupHeader}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link>
        <div className={styles.setupHeaderActions}>
          <Link href="/onboard" className={styles.headerLink}>Integrations</Link>
          <SignOutButton className={styles.signOut} />
        </div>
      </header>

      <section className={styles.setupContent}>
        <div className={styles.setupIntro}>
          <Link href="/dashboard" className={styles.backLink}>← Back to dashboard</Link>
          <p className={styles.eyebrow}>Connect your workspace</p>
          <h1>Bring Taiga into your WhatsApp flow.</h1>
          <p className={styles.setupLead}>Enter your Taiga details, then start a 7-day free trial. Razorpay opens only after this form is complete to approve ₹100/month auto-pay.</p>
        </div>

        <section className={styles.formCard} aria-labelledby="taiga-form-title">
          <div className={styles.formCardHeader}>
            <span className={styles.taigaMark}>T</span>
            <div><p className={styles.cardEyebrow}>Taiga connection</p><h2 id="taiga-form-title">Your account details</h2></div>
          </div>
          <p className={styles.formDescription}>We use these details only to connect your workspace. Your credentials are encrypted by the TaskPilot backend.</p>

          <form onSubmit={handleSubmit} className={styles.connectionForm}>
            <div className={styles.field}>
              <label htmlFor="whatsapp-number">WhatsApp number</label>
              <p>Include your country code, with no spaces.</p>
              <input id="whatsapp-number" name="phone" inputMode="tel" placeholder="e.g. 919876543210" value={form.phone} onChange={handleChange} autoComplete="tel" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="taiga-username">Taiga username</label>
              <input id="taiga-username" name="taigaUsername" placeholder="Your Taiga username" value={form.taigaUsername} onChange={handleChange} autoComplete="username" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="taiga-password">Taiga password</label>
              <div className={styles.passwordControl}>
                <input id="taiga-password" type={showPassword ? 'text' : 'password'} name="taigaPassword" placeholder="Your Taiga password" value={form.taigaPassword} onChange={handleChange} autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide Taiga password' : 'Show Taiga password'}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div className={styles.trialOffer}>
              <strong>{approved ? 'Your free trial is active.' : 'Start your 7-day free trial.'}</strong>
              <span>₹5 refundable mandate verification today. ₹100/month starts after your 7-day trial.</span>
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {billingError && <p className={styles.error} role="alert">{billingError}</p>}
            {paymentMessage && <p className={styles.paymentMessage} role="status">{paymentMessage}</p>}
            <button type="submit" disabled={loading || paymentLoading} className={styles.submitBtn}>
              {loading ? 'Connecting Taiga...' : paymentLoading ? 'Opening secure Razorpay...' : approved ? 'Connect Taiga' : 'Start 7-day free trial'}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
