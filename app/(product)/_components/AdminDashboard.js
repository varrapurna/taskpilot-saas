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
  const selectedUser = overview.users.find((user) => user.id === selectedHistoryUser) || null;
  const visibleHistory = selectedHistoryUser
    ? billing.history.filter((payment) => payment.userId === selectedHistoryUser)
    : billing.history;

  function viewPaymentHistory(userId) {
    setSelectedHistoryUser(userId);
    window.requestAnimationFrame(() => document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>Latest accounts</p><h2>Users</h2></div>
            <span>Showing latest {overview.users.length}</span>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Verification</th><th>Last sign-in</th><th>Joined</th><th>Payments</th></tr></thead>
              <tbody>
                {overview.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><span className={user.role === 'admin' ? styles.roleAdmin : styles.roleUser}>{user.role === 'admin' ? 'Admin' : 'User'}</span></td>
                    <td><span className={user.verified ? styles.verified : styles.unverified}>{user.verified ? 'Verified' : 'Pending'}</span></td>
                    <td>{formatDate(user.lastLoginAt)}</td>
                    <td>{formatDate(user.created)}</td>
                    <td><button type="button" className={styles.historyButton} onClick={() => viewPaymentHistory(user.id)}>Payment history</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!overview.users.length && <p className={styles.empty}>No users have registered yet.</p>}
          </div>
        </section>

        <section className={styles.billingPanel} aria-labelledby="billing-title">
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>Razorpay billing</p><h2 id="billing-title">Payments and auto-pay</h2><p>See who approved auto-pay, what was paid, and when a subscription ends.</p></div>
            <button type="button" className={styles.syncButton} onClick={syncBillingHistory} disabled={syncing}>{syncing ? 'Syncing Razorpay…' : 'Sync Razorpay history'}</button>
          </div>
          <div className={styles.billingMetrics} aria-label="Billing metrics">
            {billingCards.map(([label, value, detail]) => <article className={styles.billingMetric} key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
          </div>
          {syncError && <p className={styles.syncError} role="alert">{syncError}</p>}
        </section>

        <section className={styles.panel} aria-labelledby="subscriptions-title">
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Customer subscriptions</p><h2 id="subscriptions-title">Auto-pay status</h2></div><span>{billing.subscriptions.length} total</span></div>
          <div className={styles.tableWrap}>
            <table className={styles.billingTable}>
              <thead><tr><th>User</th><th>Auto-pay</th><th>Status</th><th>Last payment</th><th>Paid until</th><th>Cancelled</th></tr></thead>
              <tbody>{billing.subscriptions.map((subscription) => <tr key={subscription.id}>
                <td><strong>{subscription.userName}</strong><small>{subscription.userEmail}</small></td>
                <td><span className={subscription.autopayAccepted ? styles.verified : styles.unverified}>{subscription.autopayAccepted ? 'Approved' : 'Not approved'}</span></td>
                <td><span className={subscription.status === 'active' || subscription.status === 'trialing' ? styles.verified : styles.unverified}>{labelForStatus(subscription.status)}</span></td>
                <td>{subscription.lastPayment ? <><strong>{formatMoney(subscription.lastPayment.amount, subscription.lastPayment.currency)}</strong><small>{formatBillingDate(subscription.lastPayment.occurredAt)}</small></> : '—'}</td>
                <td>{formatBillingDate(subscription.currentPeriodEndsAt || subscription.trialEndsAt)}</td>
                <td>{subscription.cancelAtPeriodEnd ? `Ends ${formatBillingDate(subscription.currentPeriodEndsAt)}` : formatBillingDate(subscription.cancelledAt)}</td>
              </tr>)}</tbody>
            </table>
            {!billing.hasSubscriptions && <p className={styles.empty}>No one has started a TaskPilot payment yet.</p>}
          </div>
        </section>

        <section className={styles.panel} id="payment-history" aria-labelledby="payment-history-title">
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Payment history</p><h2 id="payment-history-title">{selectedUser ? `${selectedUser.name}'s Razorpay activity` : 'Razorpay activity'}</h2></div><div className={styles.historyActions}>{selectedUser ? <button type="button" className={styles.historyButton} onClick={() => setSelectedHistoryUser(null)}>Show all payments</button> : null}<span>{selectedUser ? `${visibleHistory.length} records` : `All ${visibleHistory.length}`}</span></div></div>
          <div className={styles.tableWrap}>
            <table className={styles.billingTable}>
              <thead><tr><th>Date</th><th>User</th><th>Activity</th><th>Status</th><th>Amount</th><th>Detail</th></tr></thead>
              <tbody>{visibleHistory.map((payment) => <tr key={payment.id}>
                <td>{formatBillingDate(payment.occurredAt)}</td><td><strong>{payment.userName}</strong><small>{payment.userEmail}</small></td><td>{labelForStatus(payment.eventType)}</td><td>{labelForStatus(payment.status)}</td><td>{payment.amount ? formatMoney(payment.amount, payment.currency) : '—'}</td><td>{payment.failureReason || '—'}</td>
              </tr>)}</tbody>
            </table>
            {!visibleHistory.length && <p className={styles.empty}>{selectedUser ? 'This user has no recorded Razorpay payment yet.' : 'Use “Sync Razorpay history” to load previous invoices, then future activity will appear automatically.'}</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
