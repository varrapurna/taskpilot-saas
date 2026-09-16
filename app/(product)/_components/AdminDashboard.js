'use client';

import Link from 'next/link';
import { useState } from 'react';
import SignOutButton from './SignOutButton';
import styles from '../admin/admin.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

function formatDate(value, fallback = 'Not signed in yet') {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatMoney(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0) / 100);
}

function labelForStatus(value) {
  return String(value || 'not started').replaceAll('_', ' ');
}

function paymentLabel(eventType) {
  const labels = {
    'subscription.authenticated': 'Auto-pay approved',
    'subscription.charged': 'Subscription payment',
    'invoice.paid': 'Invoice paid',
    'subscription.cancelled': 'Subscription cancelled',
    'payment.failed': 'Payment failed',
  };
  return labels[eventType] || labelForStatus(eventType);
}

function PaymentHistoryPage({ user, subscription, history, onBack }) {
  return (
    <section className={styles.historyPage} aria-labelledby="payment-history-title">
      <button type="button" className={styles.backButton} onClick={onBack}>Back to users</button>
      <div className={styles.historyHeader}>
        <div>
          <p className={styles.eyebrow}>Payment history</p>
          <h1 id="payment-history-title">{user.name}</h1>
          <p>{user.email}</p>
        </div>
        <span className={styles.recordCount}>{history.length} record{history.length === 1 ? '' : 's'}</span>
      </div>

      <dl className={styles.historyFacts}>
        <div><dt>Auto-pay</dt><dd>{subscription?.autopayAccepted ? 'Approved' : 'Not approved'}</dd></div>
        <div><dt>Plan status</dt><dd>{labelForStatus(subscription?.status)}</dd></div>
        <div><dt>Access until</dt><dd>{formatDate(subscription?.currentPeriodEndsAt || subscription?.trialEndsAt, 'Not started')}</dd></div>
        <div><dt>Last payment</dt><dd>{subscription?.lastPayment ? formatMoney(subscription.lastPayment.amount, subscription.lastPayment.currency) : 'No payment yet'}</dd></div>
      </dl>

      <div className={styles.historyRows}>
        <div className={styles.historyRowHead}><span>Activity</span><span>Date</span><span>Amount</span><span>Status</span></div>
        {history.length ? history.map((payment) => (
          <article className={styles.historyRow} key={payment.id}>
            <strong>{paymentLabel(payment.eventType)}</strong>
            <span>{formatDate(payment.occurredAt, 'Not available')}</span>
            <strong>{payment.amount ? formatMoney(payment.amount, payment.currency) : 'No charge'}</strong>
            <span className={payment.failureReason ? styles.paymentIssue : styles.paymentStatus}>{payment.failureReason || labelForStatus(payment.status)}</span>
          </article>
        )) : <p className={styles.empty}>This user has no recorded Razorpay activity yet.</p>}
      </div>
    </section>
  );
}

export default function AdminDashboard({ admin, overview }) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [selectedHistoryUser, setSelectedHistoryUser] = useState(null);
  const billing = overview.billing;
  const billingByUserId = new Map(billing.subscriptions.map((subscription) => [subscription.userId, subscription]));
  const selectedUser = overview.users.find((user) => user.id === selectedHistoryUser) || null;
  const selectedSubscription = selectedUser ? billingByUserId.get(selectedUser.id) || null : null;
  const selectedHistory = selectedHistoryUser ? billing.history.filter((payment) => payment.userId === selectedHistoryUser) : [];

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
        {selectedUser ? <PaymentHistoryPage user={selectedUser} subscription={selectedSubscription} history={selectedHistory} onBack={() => setSelectedHistoryUser(null)} /> : <>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>TaskPilot control centre</p>
            <h1>Know what is happening in your product.</h1>
            <p>This dashboard appears automatically only for your admin email.</p>
          </div>

          <section className={styles.metrics} aria-label="User metrics">
            <article><span>Total users</span><strong>{overview.metrics.totalUsers}</strong><small>All registered accounts</small></article>
            <article><span>Verified users</span><strong>{overview.metrics.verifiedUsers}</strong><small>Email verification completed</small></article>
            <article><span>New this week</span><strong>{overview.metrics.newUsersThisWeek}</strong><small>Accounts created in the last 7 days</small></article>
            <article><span>Active users</span><strong>{overview.metrics.activeUsersLast30Days}</strong><small>Signed in during the last 30 days</small></article>
          </section>

          <section className={styles.connectionsPanel} id="my-connections" aria-labelledby="my-connections-title">
            <div>
              <p className={styles.eyebrow}>My connections</p>
              <h2 id="my-connections-title">Manage your own WhatsApp workspaces.</h2>
              <p>Update your details, disconnect a workspace, or open WhatsApp without leaving your admin account.</p>
            </div>
            <div className={styles.connectionActions}>
              <Link href="/manage/taiga" className={styles.connectionAction}>Manage Taiga</Link>
              <Link href="/manage/mhconnekt" className={styles.connectionAction}>Manage MH Connekt</Link>
              <Link href="/onboard" className={styles.secondaryAction}>Connect a workspace</Link>
            </div>
          </section>

          <section className={styles.accountsPanel} aria-labelledby="users-title">
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Latest accounts</p><h2 id="users-title">Users</h2></div>
              <span>Showing latest {overview.users.length}</span>
            </div>
            <div className={styles.accountRows}>
              {overview.users.map((user) => {
                const subscription = billingByUserId.get(user.id);
                return <article className={styles.accountRow} key={user.id}>
                  <div><strong>{user.name}</strong><small>{user.email}</small></div>
                  <div><span className={user.role === 'admin' ? styles.roleAdmin : styles.roleUser}>{user.role === 'admin' ? 'Admin' : 'User'}</span><span className={user.verified ? styles.verified : styles.unverified}>{user.verified ? 'Verified' : 'Pending'}</span><small>Last sign-in: {formatDate(user.lastLoginAt)}</small></div>
                  <div>{subscription ? <><strong className={styles.billingStatus}>{labelForStatus(subscription.status)}</strong><small>{subscription.autopayAccepted ? 'Auto-pay approved' : 'Auto-pay not approved'} · Access until {formatDate(subscription.currentPeriodEndsAt || subscription.trialEndsAt, 'Not started')}</small></> : <small>No subscription started</small>}</div>
                  <button type="button" className={styles.historyButton} onClick={() => setSelectedHistoryUser(user.id)}>Payment history</button>
                </article>;
              })}
              {!overview.users.length && <p className={styles.empty}>No users have registered yet.</p>}
            </div>
          </section>

          <section className={styles.billingOverview} aria-labelledby="billing-title">
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>Billing</p><h2 id="billing-title">Payment overview</h2><p>Current auto-pay, payments, and subscriptions. Open a user's history for the full detail.</p></div>
              <button type="button" className={styles.syncButton} onClick={syncBillingHistory} disabled={syncing}>{syncing ? 'Syncing Razorpay...' : 'Sync Razorpay history'}</button>
            </div>
            <div className={styles.billingMetrics} aria-label="Billing metrics">
              <article><span>Auto-pay active</span><strong>{billing.metrics.activeAutopay}</strong><small>Trial or paid subscriptions</small></article>
              <article><span>Cancelling</span><strong>{billing.metrics.cancellingAtCycleEnd}</strong><small>Stops after the paid period</small></article>
              <article><span>Payment issues</span><strong>{billing.metrics.failedPayments}</strong><small>Failed or past-due records</small></article>
              <article><span>Collected</span><strong>{formatMoney(billing.metrics.totalCollected)}</strong><small>Recorded paid invoices</small></article>
            </div>
            {syncError && <p className={styles.syncError} role="alert">{syncError}</p>}
          </section>
        </>}
      </section>
    </main>
  );
}
