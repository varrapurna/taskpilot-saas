'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SignOutButton from '../../_components/SignOutButton';
import styles from '../onboard.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function MhConnektOnboardForm() {
  const [form, setForm] = useState({ phone: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [connection, setConnection] = useState(null);
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, { credentials: 'include' })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.error || 'Could not check MH Connekt.');
        if (!active) return;
        setConnection(body.connection || null);
        setConnected(Boolean(body.connected));
      })
      .catch(() => active && setConnected(false))
      .finally(() => active && setCheckingConnection(false));
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not connect MH Connekt.');
      setForm((value) => ({ ...value, password: '' }));
      setConnected(true);
      setConnection(null);
    } catch (requestError) { setError(requestError.message || 'Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect MH Connekt from TaskPilot? Your MH password is not stored.')) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, { method: 'DELETE', credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not disconnect MH Connekt.');
      setConnected(false);
      setConnection(null);
      setForm({ phone: '', email: '', password: '' });
    } catch (requestError) { setError(requestError.message || 'Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  return <main className={styles.setupMain}>
    <header className={styles.setupHeader}><Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link><div className={styles.setupHeaderActions}><Link href="/onboard" className={styles.headerLink}>Integrations</Link><SignOutButton className={styles.signOut} /></div></header>
    <section className={styles.setupContent}>
      <div className={styles.setupIntro}><Link href="/onboard" className={styles.backLink}>← Back to integrations</Link><p className={styles.eyebrow}>MH Connekt connection</p><h1>Manage your timesheet from WhatsApp.</h1><p className={styles.setupLead}>Connect once. TaskPilot stores encrypted MH access tokens, not your MH password.</p></div>
      <section className={styles.formCard} aria-labelledby="mh-form-title">
        {checkingConnection ? <div className={styles.connectionComplete}><p className={styles.cardEyebrow}>MH Connekt connection</p><h2 id="mh-form-title">Checking your connection...</h2></div> : connected ? <div className={styles.connectionComplete}><span className={styles.completeMark}>✓</span><p className={styles.cardEyebrow}>MH Connekt connected</p><h2 id="mh-form-title">Your timesheet is ready.</h2><p>{connection ? <>Connected as <strong>{connection.email}</strong> on <strong>{connection.whatsappNumber}</strong>.</> : 'Open TaskPilot in WhatsApp and send hi to manage your timesheet.'}</p><p className={styles.completeNote}>You can update these details or disconnect whenever you need.</p><div className={styles.completeActions}>{waNumber && <a href={`https://wa.me/${waNumber}?text=hi`} target="_blank" rel="noopener noreferrer" className={styles.submitBtn}>Open WhatsApp</a>}<button type="button" className={styles.textButton} onClick={() => { setConnected(false); setError(''); }}>Update details</button><button type="button" className={styles.textButton} onClick={disconnect} disabled={loading}>Disconnect</button><Link href="/dashboard" className={styles.dashboardLink}>Dashboard</Link></div></div> : <>
          <div className={styles.formCardHeader}><span className={styles.taigaMark}>M</span><div><p className={styles.cardEyebrow}>MH Connekt connection</p><h2 id="mh-form-title">Your account details</h2></div></div>
          <p className={styles.formDescription}>Your password is used only to connect MH Connekt. TaskPilot stores encrypted access tokens instead.</p>
          <form onSubmit={submit} className={styles.connectionForm}>
            <div className={styles.field}><label htmlFor="mh-phone">WhatsApp number</label><p>Include country code, with no spaces.</p><input id="mh-phone" name="phone" inputMode="tel" autoComplete="tel" placeholder="e.g. 919876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
            <div className={styles.field}><label htmlFor="mh-email">MH Connekt email</label><input id="mh-email" name="email" type="email" autoComplete="username" placeholder="Your MH Connekt email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className={styles.field}><label htmlFor="mh-password">MH Connekt password</label><div className={styles.passwordControl}><input id="mh-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Your MH Connekt password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></div>
            {error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? 'Connecting MH Connekt...' : 'Connect MH Connekt'}</button>
          </form>
        </>}
      </section>
    </section>
  </main>;
}
