'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminDashboard from './AdminDashboard';
import BillingPanel from './BillingPanel';
import SignOutButton from './SignOutButton';
import styles from '../dashboard/dashboard.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard`, { credentials: 'include' });
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.replace('/account/login');
          return;
        }
        if (!response.ok) throw new Error(body.error || 'We could not load your dashboard.');
        if (active) setData(body);
      } catch (loadError) {
        if (active) setError(loadError.message || 'We could not load your dashboard.');
      }
    }

    loadDashboard();
    return () => { active = false; };
  }, [router]);

  if (error) {
    return <main className={styles.main}><section className={styles.statusPanel}><h1>Dashboard unavailable</h1><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></section></main>;
  }

  if (!data) {
    return <main className={styles.main}><section className={styles.statusPanel}><h1>Loading your dashboard…</h1><p>Checking your TaskPilot account securely.</p></section></main>;
  }

  if (data.role === 'admin') return <AdminDashboard admin={data.admin} overview={data.overview} />;

  const { user, integrations, billing } = data;
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=hi` : null;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link>
        <div className={styles.headerActions}>
          <Link href="/onboard" className={styles.headerLink}>Integrations</Link>
          <SignOutButton className={styles.signOut} />
        </div>
      </header>

      <section className={styles.content}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Your work, inside WhatsApp</p>
            <h1>Hello, {user.name || 'there'}.</h1>
            <p>Connect your workspace once, then handle quick work updates from the WhatsApp chat you already use.</p>
          </div>
          <div className={styles.accountChip}><span>{user.name?.charAt(0)?.toUpperCase() || 'T'}</span><div><strong>{user.name || 'TaskPilot user'}</strong><small>{user.email}</small></div></div>
        </div>

        <section className={styles.integrationGrid} aria-label="Your integrations">
          <article className={styles.integrationCard}>
            <div className={styles.cardTop}><span className={styles.icon}>✓</span><span className={integrations.taigaConnected ? styles.connected : styles.notConnected}>{integrations.taigaConnected ? 'Connected' : 'Not connected'}</span></div>
            <h2>Taiga</h2>
            <p>{integrations.taigaConnected ? 'Your Taiga tasks are ready to manage from WhatsApp.' : 'Connect Taiga to see tasks, add comments, and update status from WhatsApp.'}</p>
            <Link href={integrations.taigaConnected ? '/manage/taiga' : '/onboard/taiga'} className={styles.cardAction}>{integrations.taigaConnected ? 'Manage Taiga connection' : 'Connect Taiga'} <span aria-hidden="true">→</span></Link>
          </article>
          <article className={styles.integrationCard}>
            <div className={styles.cardTop}><span className={styles.icon}>M</span><span className={styles.soon}>Coming later</span></div>
            <h2>MH Connekt</h2>
            <p>Timesheets, daily summaries, and reminders will be added after the account and billing work is complete.</p>
            <span className={styles.mutedAction}>Setup will be available later</span>
          </article>
        </section>

        <section className={styles.workGrid}>
          <article className={styles.whatsappPanel}>
            <p className={styles.eyebrow}>Start in WhatsApp</p>
            <h2>{integrations.taigaConnected ? 'Your Taiga chat is ready.' : 'Connect Taiga to start.'}</h2>
            <p>{integrations.taigaConnected ? 'Open the TaskPilot WhatsApp chat and send hi. We will welcome you, then you can send tasks to see your open work.' : 'Your WhatsApp number is linked during the Taiga connection. There is no separate WhatsApp setup.'}</p>
            {integrations.taigaConnected && waLink ? <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.whatsappButton}>Open WhatsApp and send hi</a> : <Link href="/onboard/taiga" className={styles.whatsappButton}>Connect Taiga</Link>}
          </article>

          <article className={styles.commandsPanel}>
            <p className={styles.eyebrow}>WhatsApp guide</p>
            <h2>Simple commands</h2>
            <dl>
              <div><dt>tasks</dt><dd>See your open Taiga tasks</dd></div>
              <div><dt>1</dt><dd>Add a comment to the current task</dd></div>
              <div><dt>2</dt><dd>Change a task or story status</dd></div>
              <div><dt>end</dt><dd>Finish the current session</dd></div>
            </dl>
          </article>
        </section>

        <section className={styles.lowerGrid}>
          <article className={styles.accountPanel}>
            <p className={styles.eyebrow}>Account</p>
            <h2>Your profile</h2>
            <p>Signed in as <strong>{user.email}</strong>. Your work connections belong to this TaskPilot account.</p>
          </article>
          <BillingPanel billing={billing} />
        </section>
      </section>
    </main>
  );
}
