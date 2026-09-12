'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '../../_components/SignOutButton';
import styles from './taiga-manage.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

function trialMessage(billing) {
  if (billing?.status === 'active') return 'Your ₹100/month plan is active.';
  if (billing?.status === 'trialing') {
    const trialEndsAt = new Date(billing.trialEndsAt);
    const days = Number.isNaN(trialEndsAt.getTime()) ? null : Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86_400_000));
    return `${days === null ? 'Your free trial is active.' : `${days} day${days === 1 ? '' : 's'} left in your free trial.`} ₹100/month starts when it ends.`;
  }
  return 'No active subscription.';
}

export default function TaigaManageClient() {
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
    fetch(`${API_BASE_URL}/api/integrations/taiga`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.replace('/account/login');
          return null;
        }
        if (!response.ok) throw new Error(body.error || 'We could not load your Taiga connection.');
        return body;
      })
      .then((body) => {
        if (!body || !active) return;
        if (!body.connected) {
          setNotConnected(true);
          return;
        }
        setData(body);
      })
      .catch((requestError) => active && setError(requestError.message || 'We could not load your Taiga connection.'));
    return () => { active = false; };
  }, [router]);

  async function disconnect() {
    setDisconnecting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/integrations/taiga`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'We could not disconnect Taiga.');
      router.replace('/dashboard');
      router.refresh();
    } catch (requestError) {
      setError(requestError.message || 'We could not disconnect Taiga.');
      setDisconnecting(false);
    }
  }

  if (error && !data) return <main className={styles.main}><section className={styles.status}><h1>Taiga connection unavailable</h1><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></section></main>;
  if (notConnected) return <main className={styles.main}><section className={styles.status}><p className={styles.eyebrow}>Taiga connection</p><h1>No workspace connected.</h1><p>Connect Taiga to manage work from WhatsApp.</p><Link href="/onboard/taiga" className={styles.statusLink}>Connect Taiga</Link></section></main>;
  if (!data) return <main className={styles.main}><section className={styles.status}><h1>Loading your Taiga connection…</h1><p>Checking your connection securely.</p></section></main>;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link>
        <div className={styles.headerActions}><Link href="/dashboard" className={styles.headerLink}>Dashboard</Link><SignOutButton className={styles.signOut} /></div>
      </header>

      <section className={styles.shell}>
        <Link href="/dashboard" className={styles.back}>← Back to dashboard</Link>
        <div className={styles.intro}><div><p className={styles.eyebrow}>Taiga connection</p><h1>Your workspace is connected.</h1><p>Use WhatsApp to view Taiga work, add comments, and update task status without opening another app.</p></div><span className={styles.connected}>Connected</span></div>

        <section className={styles.details} aria-label="Connection details">
          <div className={styles.sectionHead}><p className={styles.eyebrow}>Connection details</p><h2>Your setup</h2></div>
          <dl className={styles.detailList}>
            <div><dt>Taiga username</dt><dd>{data.connection.taigaUsername}</dd></div>
            <div><dt>WhatsApp number</dt><dd>{data.connection.whatsappNumber}</dd></div>
            <div><dt>TaskPilot account</dt><dd>{data.connection.accountEmail}</dd></div>
          </dl>
          <Link href="/manage/taiga/update" className={styles.textAction}>Update Taiga details →</Link>
        </section>

        <section className={styles.billing} aria-label="Subscription details">
          <div className={styles.sectionHead}><p className={styles.eyebrow}>Billing</p><h2>{data.billing?.status === 'trialing' ? 'Your free trial is active.' : 'Your subscription'}</h2></div>
          <div><p>{trialMessage(data.billing)}</p><small>Auto-pay is charged only by Razorpay. It is cancelled if you disconnect Taiga below.</small></div>
        </section>

        <section className={styles.guide} aria-label="WhatsApp commands"><p className={styles.eyebrow}>Use it in WhatsApp</p><h2>Start by sending hi.</h2><p>TaskPilot will welcome you. Then send <strong>tasks</strong> to see your open Taiga work, reply with <strong>1</strong> to comment, <strong>2</strong> to change status, or <strong>end</strong> to finish.</p>{welcomeLink && <a href={welcomeLink} target="_blank" rel="noopener noreferrer" className={styles.whatsappButton}>Open WhatsApp and send hi</a>}</section>

        <section className={styles.danger} aria-label="Disconnect Taiga">
          <div><p className={styles.eyebrow}>Disconnect</p><h2>Stop using Taiga with TaskPilot.</h2><p>Disconnecting removes your encrypted Taiga credentials and immediately cancels your Razorpay auto-pay. You will no longer receive Taiga work in WhatsApp.</p></div>
          {!confirming ? <button type="button" className={styles.disconnectButton} onClick={() => setConfirming(true)}>Disconnect Taiga</button> : <div className={styles.confirmation}><p>Cancel auto-pay and disconnect this workspace?</p><div><button type="button" className={styles.cancelButton} onClick={() => setConfirming(false)} disabled={disconnecting}>Keep connection</button><button type="button" className={styles.disconnectButton} onClick={disconnect} disabled={disconnecting}>{disconnecting ? 'Disconnecting…' : 'Cancel auto-pay & disconnect'}</button></div></div>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </section>
      </section>
    </main>
  );
}
