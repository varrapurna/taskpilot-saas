'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './onboard.module.css';

export default function OnboardPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    taigaUsername: '',
    taigaPassword: '',
    taigaBaseUrl: 'https://api.taiga.io/api/v1',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        router.push(`/dashboard?phone=${encodeURIComponent(form.phone)}&name=${encodeURIComponent(form.name)}`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1>📋 Connect Your Taiga Account</h1>
        <p className={styles.subtitle}>
          Fill in your details below. We&apos;ll verify your Taiga login and you&apos;ll be ready in seconds.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>Your Name</label>
          <input
            name="name"
            placeholder="e.g. Purnachandra"
            value={form.name}
            onChange={handleChange}
            required
          />

          <label>WhatsApp Number <span className={styles.hint}>(with country code, no spaces)</span></label>
          <input
            name="phone"
            placeholder="e.g. 917569489092"
            value={form.phone}
            onChange={handleChange}
            required
          />

          <label>Taiga Username</label>
          <input
            name="taigaUsername"
            placeholder="Your Taiga username"
            value={form.taigaUsername}
            onChange={handleChange}
            required
          />

          <label>Taiga Password</label>
          <input
            type="password"
            name="taigaPassword"
            placeholder="Your Taiga password"
            value={form.taigaPassword}
            onChange={handleChange}
            required
          />

          <label>Taiga URL <span className={styles.hint}>(leave as-is for taiga.io)</span></label>
          <input
            name="taigaBaseUrl"
            value={form.taigaBaseUrl}
            onChange={handleChange}
            required
          />

          {error && <p className={styles.error}>⚠️ {error}</p>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Connecting...' : 'Connect & Activate'}
          </button>
        </form>
      </div>
    </main>
  );
}
