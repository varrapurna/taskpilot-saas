import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminDashboard from '../_components/AdminDashboard';
import BillingPanel from '../_components/BillingPanel';
import SignOutButton from '../_components/SignOutButton';
import { getAdminOverview } from '@/server/admin/overview';
import { getAuthenticatedClient } from '@/server/auth/account';
import { getBillingSummaryForUser, startTrialForUser } from '@/server/billing/subscriptions';
import { getIntegrationStatusForUser } from '@/server/database/pocketbase';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
  const client = await getAuthenticatedClient();
  if (!client) redirect('/account/login');
  if (client.record.role === 'admin') {
    const overview = await getAdminOverview();
    return <AdminDashboard admin={client.record} overview={overview} />;
  }

  const [integrations] = await Promise.all([
    getIntegrationStatusForUser(client.record.id),
    startTrialForUser(client.record.id),
  ]);
  const billing = await getBillingSummaryForUser(client.record.id);
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=tasks` : null;

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
            <h1>Hello, {client.record.name || 'there'}.</h1>
            <p>Connect your workspace once, then handle quick work updates from the WhatsApp chat you already use.</p>
          </div>
          <div className={styles.accountChip}><span>{client.record.name?.charAt(0)?.toUpperCase() || 'T'}</span><div><strong>{client.record.name || 'TaskPilot user'}</strong><small>{client.record.email}</small></div></div>
        </div>

        <section className={styles.integrationGrid} aria-label="Your integrations">
          <article className={styles.integrationCard}>
            <div className={styles.cardTop}><span className={styles.icon}>✓</span><span className={integrations.taigaConnected ? styles.connected : styles.notConnected}>{integrations.taigaConnected ? 'Connected' : 'Not connected'}</span></div>
            <h2>Taiga</h2>
            <p>{integrations.taigaConnected ? 'Your Taiga tasks are ready to manage from WhatsApp.' : 'Connect Taiga to see tasks, add comments, and update status from WhatsApp.'}</p>
            <Link href="/onboard/taiga" className={styles.cardAction}>{integrations.taigaConnected ? 'Manage Taiga connection' : 'Connect Taiga'} <span aria-hidden="true">→</span></Link>
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
            <p>{integrations.taigaConnected ? 'Open the TaskPilot WhatsApp chat and type “tasks” to see your open work.' : 'Your WhatsApp number is linked during the Taiga connection. There is no separate WhatsApp setup.'}</p>
            {integrations.taigaConnected && waLink ? <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.whatsappButton}>Open WhatsApp chat</a> : <Link href="/onboard/taiga" className={styles.whatsappButton}>Connect Taiga</Link>}
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
            <p>Signed in as <strong>{client.record.email}</strong>. Your work connections belong to this TaskPilot account.</p>
          </article>
          <BillingPanel billing={billing} />
        </section>
      </section>
    </main>
  );
}
