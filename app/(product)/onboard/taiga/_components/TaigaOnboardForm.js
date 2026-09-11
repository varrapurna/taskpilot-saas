'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '../../../_components/SignOutButton';
import styles from '../../onboard.module.css';

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

export default function TaigaOnboardForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: '',
    taigaUsername: '',
    taigaPassword: '',
    taigaBaseUrl: 'https://api.taiga.io/api/v1',
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

  async function waitForApproval() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const latestBilling = await loadBilling();
        if (latestBilling?.autopayAccepted) {
          setPaymentMessage('Auto-pay accepted. You can now connect Taiga.');
          setPaymentLoading(false);
          return;
        }
      } catch {
        // Keep checking while the Razorpay webhook is being delivered.
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
      if (!response.ok) throw new Error(body.error || 'We could not start auto-pay.');

      const Razorpay = await loadRazorpayCheckout();
      if (!Razorpay) throw new Error('Razorpay checkout could not load.');
      const checkout = new Razorpay({
        key: body.checkout.keyId,
        subscription_id: body.checkout.subscriptionId,
        name: 'TaskPilot',
        description: '₹100/month after your free trial',
        recurring: true,
        handler: () => {
          setPaymentMessage('Razorpay accepted your auto-pay. Confirming it securely…');
          waitForApproval();
        },
        modal: { ondismiss: () => setPaymentLoading(false) },
      });
      checkout.open();
    } catch (requestError) {
      setPaymentMessage(requestError.message || 'We could not start auto-pay.');
      setPaymentLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!billing?.autopayAccepted) {
      setError('Set up and approve auto-pay before connecting Taiga.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          <p className={styles.setupLead}>Set up secure auto-pay once, then connect Taiga and manage your work from the WhatsApp chat you already use.</p>

          <ol className={styles.stepsList}>
            <li><span>1</span><div><strong>Approve ₹100/month auto-pay</strong><small>Razorpay opens its own secure payment window. Your first charge is after the free trial.</small></div></li>
            <li><span>2</span><div><strong>Connect your Taiga account</strong><small>Your Taiga workspace and tasks stay connected to your TaskPilot account.</small></div></li>
            <li><span>3</span><div><strong>Start with “tasks” in WhatsApp</strong><small>See your open work without opening another app.</small></div></li>
          </ol>
        </div>

        <section className={styles.formCard} aria-labelledby="taiga-form-title">
          {!approved ? (
            <div className={styles.paymentStep}>
              <p className={styles.cardEyebrow}>Step 1 of 2</p>
              <h2 id="taiga-form-title">Set up auto-pay first.</h2>
              <p>Razorpay opens a secure window outside TaskPilot to approve your ₹100/month auto-pay. You will not be charged before your 7-day free trial ends.</p>
              <button type="button" className={styles.submitBtn} onClick={beginAutopay} disabled={paymentLoading || !billing}>{paymentLoading ? 'Opening secure Razorpay…' : 'Set up ₹100/month auto-pay'}</button>
              {paymentMessage && <p className={styles.paymentMessage} role="status">{paymentMessage}</p>}
              {billingError && <p className={styles.error} role="alert">{billingError}</p>}
            </div>
          ) : (
            <>
              <div className={styles.approvedNotice}><span>✓</span><div><strong>Auto-pay accepted</strong><small>Step 2: connect your Taiga workspace.</small></div></div>
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
                <details className={styles.advancedField}>
                  <summary>Advanced: Taiga API URL</summary>
                  <p>Leave this unchanged unless your organisation uses its own Taiga server.</p>
                  <input name="taigaBaseUrl" value={form.taigaBaseUrl} onChange={handleChange} inputMode="url" required />
                </details>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <button type="submit" disabled={loading} className={styles.submitBtn}>{loading ? 'Connecting Taiga…' : 'Connect Taiga'}</button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
