'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <main className={styles.main}>
      <div className={styles.card}>
        <Link href="/dashboard" className={styles.backLink}>← Dashboard</Link>
        <h1>Connect your Taiga account</h1>
        <p className={styles.subtitle}>Your WhatsApp number is linked as part of this Taiga connection. You do not need a separate WhatsApp setup.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>WhatsApp Number <span className={styles.hint}>(with country code, no spaces)</span></label>
          <input name="phone" inputMode="tel" placeholder="e.g. 917569489092" value={form.phone} onChange={handleChange} autoComplete="tel" required />

          <label>Taiga Username</label>
          <input name="taigaUsername" placeholder="Your Taiga username" value={form.taigaUsername} onChange={handleChange} autoComplete="username" required />

          <label>Taiga Password</label>
          <input type="password" name="taigaPassword" placeholder="Your Taiga password" value={form.taigaPassword} onChange={handleChange} autoComplete="current-password" required />

          <label>Taiga URL <span className={styles.hint}>(leave as-is for taiga.io)</span></label>
          <input name="taigaBaseUrl" value={form.taigaBaseUrl} onChange={handleChange} inputMode="url" required />

          {error && <p className={styles.error}>⚠️ {error}</p>}
          <button type="submit" disabled={loading} className={styles.submitBtn}>{loading ? 'Connecting...' : 'Connect Taiga'}</button>
        </form>
      </div>
    </main>
  );
}
