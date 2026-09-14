'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '../../../_components/SignOutButton';
import styles from '../../taiga/update/taiga-update.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function MhConnektUpdateClient() {
  const router = useRouter();
  const [connection, setConnection] = useState(null);
  const [form, setForm] = useState({ phone: '', email: '', password: '', currentTaskPilotPassword: '' });
  const [showMhPassword, setShowMhPassword] = useState(false);
  const [showTaskPilotPassword, setShowTaskPilotPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) { router.replace('/account/login'); return null; }
        if (!response.ok) throw new Error(body.error || 'We could not load your MH Connekt connection.');
        if (!body.connected) { router.replace('/onboard/mhconnekt'); return null; }
        return body.connection;
      })
      .then((nextConnection) => active && nextConnection && setConnection(nextConnection))
      .catch((requestError) => active && setError(requestError.message || 'We could not load your MH Connekt connection.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [router]);

  function handleChange(event) { setForm((previous) => ({ ...previous, [event.target.name]: event.target.value })); }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not update your MH Connekt connection.');
      setUpdated(true);
    } catch (requestError) { setError(requestError.message || 'We could not update your MH Connekt connection.'); }
    finally { setSaving(false); }
  }

  if (loading) return <main className={styles.status}><h1>Loading your MH Connekt connection…</h1><p>Checking your saved details securely.</p></main>;
  if (error && !connection) return <main className={styles.status}><h1>MH Connekt connection unavailable</h1><p>{error}</p><Link href="/manage/mhconnekt">Back to MH Connekt settings</Link></main>;
  if (!connection) return null;

  return <main className={styles.main}>
    <header className={styles.header}><Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link><div className={styles.headerActions}><Link href="/manage/mhconnekt" className={styles.headerLink}>MH Connekt settings</Link><SignOutButton className={styles.signOut} /></div></header>
    <section className={styles.content}>
      <aside className={styles.intro}><Link href="/manage/mhconnekt" className={styles.back}>← Back to MH Connekt settings</Link><p className={styles.eyebrow}>MH Connekt connection</p><h1>Update your timesheet details.</h1><p>Change your WhatsApp number or MH Connekt email without interrupting your TaskPilot plan.</p><div className={styles.assurance}><strong>Your current connection stays active until an updated MH login is verified.</strong><span>Your current TaskPilot password confirms this sensitive change. Enter an MH password only when you change its email or want to refresh the MH connection.</span></div></aside>
      <section className={styles.formPanel} aria-labelledby="update-mh-title">
        {updated ? <div className={styles.success}><span aria-hidden="true">✓</span><p className={styles.cardEyebrow}>Connection updated</p><h2 id="update-mh-title">Your new MH Connekt details are saved.</h2><p>Open WhatsApp and send <strong>hi</strong> whenever you are ready to continue your timesheet.</p><Link href="/manage/mhconnekt" className={styles.primaryAction}>Back to MH Connekt settings</Link></div> : <>
          <div className={styles.formHeading}><span className={styles.taigaMark}>M</span><div><p className={styles.cardEyebrow}>Update connection</p><h2 id="update-mh-title">New account details</h2></div></div>
          <p className={styles.description}>Enter only the details you want to change. Leave the rest blank.</p>
          <dl className={styles.currentDetails} aria-label="Current connection details"><div><dt>Current WhatsApp number</dt><dd>{connection.whatsappNumber}</dd></div><div><dt>Current MH Connekt email</dt><dd>{connection.email}</dd></div></dl>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}><label htmlFor="new-mh-whatsapp-number">New WhatsApp number</label><p>Include country code, with no spaces.</p><input id="new-mh-whatsapp-number" name="phone" inputMode="tel" autoComplete="tel" placeholder="Leave blank to keep current number" value={form.phone} onChange={handleChange} /></div>
            <div className={styles.field}><label htmlFor="new-mh-email">New MH Connekt email</label><p>Enter the MH password below when changing this email.</p><input id="new-mh-email" name="email" type="email" autoComplete="username" placeholder="Leave blank to keep current email" value={form.email} onChange={handleChange} /></div>
            <div className={styles.field}><label htmlFor="new-mh-password">MH Connekt password</label><div className={styles.passwordControl}><input id="new-mh-password" name="password" type={showMhPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Needed when changing MH email" value={form.password} onChange={handleChange} /><button type="button" onClick={() => setShowMhPassword((visible) => !visible)}>{showMhPassword ? 'Hide' : 'Show'}</button></div></div>
            <div className={styles.confirmation}><strong>Confirm this change</strong><p>Enter your current TaskPilot password. This protects your saved MH connection.</p><div className={styles.passwordControl}><input id="current-taskpilot-password" name="currentTaskPilotPassword" type={showTaskPilotPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Current TaskPilot password" value={form.currentTaskPilotPassword} onChange={handleChange} required /><button type="button" onClick={() => setShowTaskPilotPassword((visible) => !visible)}>{showTaskPilotPassword ? 'Hide' : 'Show'}</button></div></div>
            {error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" className={styles.primaryAction} disabled={saving}>{saving ? 'Verifying and saving…' : 'Verify and update MH Connekt'}</button>
          </form>
        </>}
      </section>
    </section>
  </main>;
}
