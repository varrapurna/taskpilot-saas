'use client';

import Link from 'next/link';
import { useState } from 'react';
import SignOutButton from './SignOutButton';
import styles from '../admin/admin.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

function formatDate(value) {
  if (!value) return 'Not signed in yet';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatBillingDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatMoney(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0) / 100);
}

function labelForStatus(value) {
  return String(value || 'not_started').replaceAll('_', ' ');
}

export default function AdminDashboard({ admin, overview }) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);
  const cards = [
    ['Total users', overview.metrics.totalUsers, 'All registered accounts'],
    ['Verified users', overview.metrics.verifiedUsers, 'Email verification completed'],
    ['New this week', overview.metrics.newUsersThisWeek, 'Accounts created in the last 7 days'],
    ['Active users', overview.metrics.activeUsersLast30Days, 'Signed in during the last 30 days'],
  ];
  const billing = overview.billing;
  const billingCards = [
    ['Auto-pay active', billing.metrics.activeAutopay, 'Trial or paid subscriptions'],
    ['Cancelling', billing.metrics.cancellingAtCycleEnd, 'Stops after the paid period'],
    ['Payment issues', billing.metrics.failedPayments, 'Failed or past-due payment records'],
    ['Collected', formatMoney(billing.metrics.totalCollected), 'Recorded paid subscription invoices'],
  ];
  const billingByUserId = new Map(billing.subscriptions.map((subscription) => [subscription.userId, subscription]));
  const selectedUser = overview.users.find((user) => user.id === selectedHistoryUser) || null;
  const selectedSubscription = selectedUser ? billingByUserId.get(selectedUser.id) || null : null;
  const visibleHistory = selectedHistoryUser
    ? billing.history.filter((payment) => payment.userId === selectedHistoryUser)
    : billing.history;

  function viewPaymentHistory(userId) {
    setSelectedHistoryUser(userId);
  }

  async function syncBillingHistory() {
    setSyncing(true);
    setSyncError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/billing/sync`, { method: 'POST', credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Razorpay history could not be synced.');
      window.location.reload();
    } catch (error) {
      setSyncError(error.message || 'Razorpay history could not be synced.');
      setSyncing(false);
    }
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span><small>Admin</small></Link>
        <div className={styles.headerActions}>
          <Link href="#my-connections" className={styles.myConnectionsLink}>My connections</Link>
          <span className={styles.adminName}>{admin.name}</span>
          <SignOutButton className={styles.signOut} />
        </div>
      </header>

      <section className={styles.content}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>TaskPilot control centre</p>
          <h1>Know what is happening in your product.</h1>
          <p>This dashboard appears automatically only for your admin email.</p>
        </div>

        <section className={styles.metrics} aria-label="User metrics">
          {cards.map(([label, value, detail]) => (
            <article className={styles.metric} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </section>

        <section className={styles.connectionsPanel} id="my-connections" aria-labelledby="my-connections-title">
          <div>
            <p className={styles.eyebrow}>My connections</p>
            <h2 id="my-connections-title">Manage your own WhatsApp workspaces.</h2>
            <p>These are your personal TaskPilot connections. Update details, disconnect a workspace, or open WhatsApp without leaving your admin account.</p>
          </div>
          <div className={styles.connectionActions}>
            <Link href="/manage/taiga" className={styles.connectionAction}>Manage Taiga</Link>
            <Link href="/manage/mhconnekt" className={styles.connectionAction}>Manage MH Connekt</Link>
            <Link href="/onboard" className={styles.secondaryAction}>Connect a workspace</Link>
          </div>
        </section>

        <section className={styles.accountsPanel}>
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>Latest accounts</p><h2>Users</h2></div>
            <span>Showing latest {overview.users.length}</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.accountTable}>
              <thead><tr><th>User</th><th>Account</th><th>Billing</th><th>Payments</th></tr></thead>
              <tbody>
                {overview.users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><small>{user.email}</small></td>
                    <td><span className={user.role === 'admin' ? styles.roleAdmin : styles.roleUser}>{user.role === 'admin' ? 'Admin' : 'User'}</span><span className={user.verified ? styles.verified : styles.unverified}>{user.verified ? 'Verified' : 'Pending'}</span><small>Last sign-in: {formatDate(user.lastLoginAt)}</small></td>
                    <td>{billingByUserId.get(user.id) ? <><span className={['active', 'trialing'].includes(billingByUserId.get(user.id).status) ? styles.verified : styles.unverified}>{labelForStatus(billingByUserId.get(user.id).status)}</span><small>{billingByUserId.get(user.id).autopayAccepted ? 'Auto-pay approved' : 'Auto-pay not approved'} · Until {formatBillingDate(billingByUserId.get(user.id).currentPeriodEndsAt || billingByUserId.get(user.id).trialEndsAt)}</small></> : <small>No subscription started</small>}</td>
                    <td><button type="button" className={styles.historyButton} onClick={() => viewPaymentHistory(user.id)}>Payment history</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!overview.users.length && <p className={styles.empty}>No users have registered yet.</p>}
          </div>
        </section>

        <section className={styles.billingOverview} aria-labelledby="billing-title">
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>Billing</p><h2 id="billing-title">Payment overview</h2><p>Current auto-pay, payments, and subscriptions. Open a user’s history for the full detail.</p></div>
            <button type="button" className={styles.syncButton} onClick={syncBillingHistory} disabled={syncing}>{syncing ? 'Syncing Razorpay…' : 'Sync Razorpay history'}</button>
          </div>
          <div className={styles.billingMetrics} aria-label="Billing metrics">
            {billingCards.map(([label, value, detail]) => <article className={styles.billingMetric} key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
          </div>
          {syncError && <p className={styles.syncError} role="alert">{syncError}</p>}
        </section>

        {selectedUser && <div className={styles.historyBackdrop} role="presentation" onMouseDown={() => setSelectedHistoryUser(null)}>
          <section className={styles.historyDialog} role="dialog" aria-modal="true" aria-labelledby="payment-history-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.historyDialogHead}><div><p className={styles.eyebrow}>Payment history</p><h2 id="payment-history-title">{selectedUser.name}</h2><p>{selectedUser.email}</p></div><button type="button" className={styles.closeButton} onClick={() => setSelectedHistoryUser(null)} aria-label="Close payment history">Close</button></div>
            <dl className={styles.historySummary}><div><dt>Auto-pay</dt><dd>{selectedSubscription?.autopayAccepted ? 'Approved' : 'Not approved'}</dd></div><div><dt>Status</dt><dd>{labelForStatus(selectedSubscription?.status)}</dd></div><div><dt>Paid until</dt><dd>{formatBillingDate(selectedSubscription?.currentPeriodEndsAt || selectedSubscription?.trialEndsAt)}</dd></div><div><dt>Records</dt><dd>{visibleHistory.length}</dd></div></dl>
            <div className={styles.historyList}>{visibleHistory.length ? visibleHistory.map((payment) => <article key={payment.id}><div><strong>{labelForStatus(payment.eventType)}</strong><small>{formatBillingDate(payment.occurredAt)} · {labelForStatus(payment.status)}</small></div><div><strong>{payment.amount ? formatMoney(payment.amount, payment.currency) : '—'}</strong><small>{payment.failureReason || 'No issue recorded'}</small></div></article>) : <p className={styles.empty}>This user has no recorded Razorpay payment yet.</p>}</div>
          </section>
        </div>}
      </section>
    </main>
  );
}
