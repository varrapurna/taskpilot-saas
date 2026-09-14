'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '../../_components/SignOutButton';
import styles from '../taiga/taiga-manage.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

function billingMessage(billing) {
  if (billing?.status === 'active') return 'Your ₹100/month plan is active.';
  if (billing?.status === 'trialing') {
    const trialEndsAt = new Date(billing.trialEndsAt);
    const days = Number.isNaN(trialEndsAt.getTime()) ? null : Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86_400_000));
    return days === null ? 'Your free trial is active.' : `${days} day${days === 1 ? '' : 's'} left in your free trial.`;
  }
  return 'No active subscription.';
}

export default function MhConnektManageClient() {
  const router = useRouter();
  const taskPilotNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
  const welcomeLink = taskPilotNumber ? `https://wa.me/${taskPilotNumber}?text=hi` : null;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notConnected, setNotConnected] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) { router.replace('/account/login'); return null; }
        if (!response.ok) throw new Error(body.error || 'We could not load your MH Connekt connection.');
        return body;
      })
      .then((body) => {
        if (!body || !active) return;
        if (!body.connected) { setNotConnected(true); return; }
        setData(body);
      })
      .catch((requestError) => active && setError(requestError.message || 'We could not load your MH Connekt connection.'));
    return () => { active = false; };
  }, [router]);

  async function disconnect() {
    setDisconnecting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, { method: 'DELETE', credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not disconnect MH Connekt.');
      router.replace('/dashboard');
      router.refresh();
    } catch (requestError) {
      setError(requestError.message || 'We could not disconnect MH Connekt.');
      setDisconnecting(false);
    }
  }

  if (error && !data) return <main className={styles.main}><section className={styles.status}><h1>MH Connekt connection unavailable</h1><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></section></main>;
  if (notConnected) return <main className={styles.main}><section className={styles.status}><p className={styles.eyebrow}>MH Connekt connection</p><h1>No timesheet account connected.</h1><p>Connect MH Connekt to manage timesheets from WhatsApp.</p><Link href="/onboard/mhconnekt" className={styles.statusLink}>Connect MH Connekt</Link></section></main>;
  if (!data) return <main className={styles.main}><section className={styles.status}><h1>Loading your MH Connekt connection…</h1><p>Checking your connection securely.</p></section></main>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link>
        <div className={styles.headerActions}><Link href="/dashboard" className={styles.headerLink}>Dashboard</Link><SignOutButton className={styles.signOut} /></div>
      </header>

      <section className={styles.shell}>
        <Link href="/dashboard" className={styles.back}>← Back to dashboard</Link>
        <div className={styles.intro}><div><p className={styles.eyebrow}>MH Connekt connection</p><h1>Your timesheet is connected.</h1><p>Use WhatsApp to prepare daily timesheet activities and review your week without opening another app.</p></div><span className={styles.connected}>Connected</span></div>

        <section className={styles.details} aria-label="Connection details">
          <div className={styles.sectionHead}><p className={styles.eyebrow}>Connection details</p><h2>Your setup</h2></div>
          <dl className={styles.detailList}>
            <div><dt>MH Connekt email</dt><dd>{data.connection.email}</dd></div>
            <div><dt>WhatsApp number</dt><dd>{data.connection.whatsappNumber}</dd></div>
            <div><dt>TaskPilot account</dt><dd>{data.connection.accountEmail}</dd></div>
          </dl>
          <Link href="/manage/mhconnekt/update" className={styles.textAction}>Update MH Connekt details →</Link>
        </section>

        <section className={styles.billing} aria-label="Subscription details">
          <div className={styles.sectionHead}><p className={styles.eyebrow}>Billing</p><h2>{data.billing?.status === 'trialing' ? 'Your free trial is active.' : 'Your subscription'}</h2></div>
          <div><p>{billingMessage(data.billing)}</p><small>Your TaskPilot plan stays unchanged if you disconnect only MH Connekt.</small></div>
        </section>

        <section className={styles.guide} aria-label="WhatsApp guide">
          <p className={styles.eyebrow}>WhatsApp guide</p>
          <h2>Start with a simple hello.</h2>
          <p>TaskPilot guides you with taps. Choose a project, choose a task, and enter only the time you worked.</p>
          <ol className={styles.guideSteps}>
            <li><span>1</span><div><strong>Send hi</strong><small>TaskPilot opens your MH Connekt timesheet menu.</small></div></li>
            <li><span>2</span><div><strong>Tap Fill time</strong><small>Choose the date, project, and assigned task.</small></div></li>
            <li><span>3</span><div><strong>Choose time worked</strong><small>Review the prepared entry before it is saved as a draft.</small></div></li>
            <li><span>4</span><div><strong>Tap My week</strong><small>Review your Monday-to-Sunday timesheet.</small></div></li>
          </ol>
          {welcomeLink && <a href={welcomeLink} target="_blank" rel="noopener noreferrer" className={styles.whatsappButton}>Open WhatsApp and send hi</a>}
        </section>

        <section className={styles.danger} aria-label="Disconnect MH Connekt">
          <div><p className={styles.eyebrow}>Disconnect</p><h2>Stop using MH Connekt with TaskPilot.</h2><p>Disconnecting removes your encrypted MH access tokens. It does not change your MH Connekt account, Taiga connection, or TaskPilot subscription.</p></div>
          {!confirming ? <button type="button" className={styles.disconnectButton} onClick={() => setConfirming(true)}>Disconnect MH Connekt</button> : <div className={styles.confirmation}><p>Remove this MH Connekt connection?</p><div><button type="button" className={styles.cancelButton} onClick={() => setConfirming(false)} disabled={disconnecting}>Keep connection</button><button type="button" className={styles.disconnectButton} onClick={disconnect} disabled={disconnecting}>{disconnecting ? 'Disconnecting…' : 'Disconnect MH Connekt'}</button></div></div>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </section>
      </section>
    </main>
  );
}
