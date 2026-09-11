'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '../../../_components/SignOutButton';
import styles from '../../onboard.module.css';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function TaigaOnboardForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: '',
    taigaUsername: '',
    taigaPassword: '',
    taigaBaseUrl: 'https://api.taiga.io/api/v1',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
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
          <p className={styles.setupLead}>Connect once, then see tasks, add comments, and update statuses from the WhatsApp chat you already use.</p>

          <div className={styles.stepsCard}>
            <p className={styles.cardEyebrow}>What happens next</p>
            <ol className={styles.stepsList}>
              <li><span>1</span><div><strong>Link your WhatsApp number</strong><small>So TaskPilot knows where to send your work updates.</small></div></li>
              <li><span>2</span><div><strong>Connect your Taiga account</strong><small>Your Taiga workspace and tasks stay connected to your TaskPilot account.</small></div></li>
              <li><span>3</span><div><strong>Start with “tasks” in WhatsApp</strong><small>See your open work without opening another app.</small></div></li>
            </ol>
          </div>
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

            <details className={styles.advancedField}>
              <summary>Advanced: Taiga API URL</summary>
              <p>Leave this unchanged unless your organisation uses its own Taiga server.</p>
              <input name="taigaBaseUrl" value={form.taigaBaseUrl} onChange={handleChange} inputMode="url" required />
            </details>

            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" disabled={loading} className={styles.submitBtn}>{loading ? 'Connecting Taiga…' : 'Connect Taiga'}</button>
          </form>
        </section>
      </section>
    </main>
  );
}
