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

  if (!data.integrationsAvailable) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link>
          <div className={styles.headerActions}><SignOutButton className={styles.signOut} /></div>
        </header>
        <section className={styles.content}>
          <div className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>Phase 1</p>
              <h1>Hello, {data.user.name || 'there'}.</h1>
              <p>Your TaskPilot account and dashboard are ready. Taiga and MH Connekt connections are being tested and will open in a later release.</p>
            </div>
            <div className={styles.accountChip}><span>{data.user.name?.charAt(0)?.toUpperCase() || 'T'}</span><div><strong>{data.user.name || 'TaskPilot user'}</strong><small>{data.user.email}</small></div></div>
          </div>
          <section className={styles.integrationGrid} aria-label="Phase 1 status">
            <article className={styles.integrationCard}>
              <div className={styles.cardTop}><span className={styles.icon}>✓</span><span className={styles.notConnected}>Phase 1</span></div>
              <h2>Connections are coming soon</h2>
              <p>Taiga, MH Connekt, WhatsApp work actions, and billing are temporarily available only to the TaskPilot admin for testing.</p>
              <span className={styles.cardAction}>Coming soon</span>
            </article>
          </section>
        </section>
      </main>
    );
  }

  const { user, integrations, billing } = data;
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=hi` : null;
  const hasTaiga = integrations.taigaConnected;
  const hasMhConnekt = integrations.mhConnektConnected;
  const hasBothWorkspaces = hasTaiga && hasMhConnekt;

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
            <div className={styles.cardTop}><span className={styles.icon}>M</span><span className={integrations.mhConnektConnected ? styles.connected : styles.notConnected}>{integrations.mhConnektConnected ? 'Connected' : 'Not connected'}</span></div>
            <h2>MH Connekt</h2>
            <p>{integrations.mhConnektConnected ? 'Your MH Connekt account is ready for WhatsApp timesheet work.' : 'Connect MH Connekt to prepare daily timesheet activities from WhatsApp.'}</p>
            <Link href={integrations.mhConnektConnected ? '/manage/mhconnekt' : '/onboard/mhconnekt'} className={styles.cardAction}>{integrations.mhConnektConnected ? 'Manage MH Connekt connection' : 'Connect MH Connekt'} <span aria-hidden="true">→</span></Link>
          </article>
        </section>

        <section className={styles.workGrid}>
          <article className={styles.whatsappPanel}>
            <p className={styles.eyebrow}>Start in WhatsApp</p>
            <h2>{hasTaiga || hasMhConnekt ? 'Your TaskPilot chat is ready.' : 'Connect a workspace to start.'}</h2>
            <p>{hasBothWorkspaces ? 'Open TaskPilot in WhatsApp and send hi. Then tap the workspace you want to use.' : hasTaiga || hasMhConnekt ? 'Open TaskPilot in WhatsApp and send hi. TaskPilot will show the actions available to you.' : 'Your WhatsApp number is linked during a workspace connection. There is no separate WhatsApp setup.'}</p>
            {(hasTaiga || hasMhConnekt) && waLink ? <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.whatsappButton}>Open WhatsApp and send hi</a> : <Link href="/onboard" className={styles.whatsappButton}>Connect a workspace</Link>}
          </article>

          <article className={styles.commandsPanel}>
            <p className={styles.eyebrow}>WhatsApp guide</p>
            <h2>Simple taps</h2>
            <dl>
              {hasBothWorkspaces ? <>
                <div><dt>hi</dt><dd>Choose Taiga work or MH timesheet</dd></div>
                <div><dt>Taiga work</dt><dd>Manage your assigned tasks and issues</dd></div>
                <div><dt>MH timesheet</dt><dd>Fill time or review your full week</dd></div>
              </> : hasMhConnekt ? <>
                <div><dt>hi</dt><dd>Open your MH Connekt actions</dd></div>
                <div><dt>Fill time</dt><dd>Choose a task and tap the time worked</dd></div>
                <div><dt>My week</dt><dd>Review this Monday-to-Sunday timesheet</dd></div>
              </> : <>
                <div><dt>hi</dt><dd>Open your Taiga actions</dd></div>
                <div><dt>My tasks</dt><dd>See assigned open tasks</dd></div>
                <div><dt>Change status</dt><dd>Update a task or issue with a tap</dd></div>
              </>}
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
