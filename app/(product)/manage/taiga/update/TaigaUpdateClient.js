'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '../../../_components/SignOutButton';
import styles from './taiga-update.module.css';
import loadingStyles from '../../connection-loading.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

function maskedUsername(username) {
  if (!username) return 'Not available';
  if (username.length <= 2) return '•••';
  return `${username.slice(0, 2)}••••${username.slice(-1)}`;
}

function cachedConnection() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.sessionStorage.getItem('taskpilot_taiga_connection');
    const connection = saved ? JSON.parse(saved) : null;
    return typeof connection?.whatsappNumber === 'string' && typeof connection?.taigaUsername === 'string'
      ? connection
      : null;
  } catch {
    return null;
  }
}

export default function TaigaUpdateClient({ initialConnection = null }) {
  const router = useRouter();
  const [connection, setConnection] = useState(() => initialConnection || cachedConnection());
  const [form, setForm] = useState({
    phone: '',
    taigaUsername: '',
    taigaPassword: '',
    currentTaskPilotPassword: '',
  });
  const [showTaigaPassword, setShowTaigaPassword] = useState(false);
  const [showTaskPilotPassword, setShowTaskPilotPassword] = useState(false);
  const [loading, setLoading] = useState(() => !initialConnection && !cachedConnection());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/integrations/taiga`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.replace('/account/login');
          return null;
        }
        if (!response.ok) throw new Error(body.error || 'We could not load your Taiga connection.');
        if (!body.connected) {
          router.replace('/onboard/taiga');
          return null;
        }
        return body.connection;
      })
      .then((nextConnection) => {
        if (!active || !nextConnection) return;
        window.sessionStorage.setItem('taskpilot_taiga_connection', JSON.stringify(nextConnection));
        setConnection(nextConnection);
      })
      .catch((requestError) => active && setError(requestError.message || 'We could not load your Taiga connection.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [initialConnection, router]);

  function handleChange(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/taiga`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not update your Taiga connection.');
      setUpdated(true);
    } catch (requestError) {
      setError(requestError.message || 'We could not update your Taiga connection.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className={`${styles.status} ${loadingStyles.fullWidth}`}><h1>Loading your Taiga connection…</h1><p>Checking your saved details securely.</p></main>;
  if (error && !connection) return <main className={`${styles.status} ${loadingStyles.fullWidth}`}><h1>Taiga connection unavailable</h1><p>{error}</p><Link href="/manage/taiga">Back to Taiga settings</Link></main>;
  if (!connection) return null;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link>
        <div className={styles.headerActions}><Link href="/manage/taiga" className={styles.headerLink}>Taiga settings</Link><SignOutButton className={styles.signOut} /></div>
      </header>

      <section className={styles.content}>
        <aside className={styles.intro}>
          <Link href="/manage/taiga" className={styles.back}>← Back to Taiga settings</Link>
          <p className={styles.eyebrow}>Taiga connection</p>
          <h1>Update your workspace details.</h1>
          <p>Change your WhatsApp number or Taiga login without interrupting your TaskPilot subscription.</p>
          <div className={styles.assurance}><strong>Your current details stay active until the new Taiga login is verified.</strong><span>We do not ask for your old Taiga password. Your current TaskPilot password confirms this sensitive change.</span></div>
        </aside>

        <section className={styles.formPanel} aria-labelledby="update-taiga-title">
          {updated ? (
            <div className={styles.success}>
              <span aria-hidden="true">✓</span>
              <p className={styles.cardEyebrow}>Connection updated</p>
              <h2 id="update-taiga-title">Your new Taiga details are saved.</h2>
              <p>Open WhatsApp and send <strong>hi</strong> whenever you are ready to start again.</p>
              <Link href="/manage/taiga" className={styles.primaryAction}>Back to Taiga settings</Link>
            </div>
          ) : <>
            <div className={styles.formHeading}><span className={styles.taigaMark}>T</span><div><p className={styles.cardEyebrow}>Update connection</p><h2 id="update-taiga-title">New account details</h2></div></div>
            <p className={styles.description}>Review your current connection, then enter only the details you want to change. Leave the rest blank.</p>

            <dl className={styles.currentDetails} aria-label="Current connection details">
              <div><dt>Current WhatsApp number</dt><dd>{connection.whatsappNumber}</dd></div>
              <div><dt>Current Taiga username</dt><dd>{maskedUsername(connection.taigaUsername)}</dd></div>
            </dl>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}><label htmlFor="new-whatsapp-number">New WhatsApp number</label><p>Include country code, with no spaces.</p><input id="new-whatsapp-number" name="phone" inputMode="tel" autoComplete="tel" placeholder="Leave blank to keep current number" value={form.phone} onChange={handleChange} /></div>
              <div className={styles.field}><label htmlFor="new-taiga-username">New Taiga username</label><input id="new-taiga-username" name="taigaUsername" autoComplete="username" placeholder="Leave blank to keep current username" value={form.taigaUsername} onChange={handleChange} /></div>
              <div className={styles.field}><label htmlFor="new-taiga-password">New Taiga password</label><div className={styles.passwordControl}><input id="new-taiga-password" name="taigaPassword" type={showTaigaPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Leave blank to keep current password" value={form.taigaPassword} onChange={handleChange} /><button type="button" onClick={() => setShowTaigaPassword((visible) => !visible)}>{showTaigaPassword ? 'Hide' : 'Show'}</button></div></div>
              <div className={styles.confirmation}><strong>Confirm this change</strong><p>Enter your current TaskPilot password. This protects your saved Taiga credentials.</p><div className={styles.passwordControl}><input id="current-taskpilot-password" name="currentTaskPilotPassword" type={showTaskPilotPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Current TaskPilot password" value={form.currentTaskPilotPassword} onChange={handleChange} required /><button type="button" onClick={() => setShowTaskPilotPassword((visible) => !visible)}>{showTaskPilotPassword ? 'Hide' : 'Show'}</button></div></div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" className={styles.primaryAction} disabled={saving}>{saving ? 'Verifying and saving…' : 'Verify and update Taiga'}</button>
            </form>
          </>}
        </section>
      </section>
    </main>
  );
}
