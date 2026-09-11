import Link from 'next/link';
import SignOutButton from './SignOutButton';
import styles from '../admin/admin.module.css';

function formatDate(value) {
  if (!value) return 'Not signed in yet';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

export default function AdminDashboard({ admin, overview }) {
  const cards = [
    ['Total users', overview.metrics.totalUsers, 'All registered accounts'],
    ['Verified users', overview.metrics.verifiedUsers, 'Email verification completed'],
    ['New this week', overview.metrics.newUsersThisWeek, 'Accounts created in the last 7 days'],
    ['Active users', overview.metrics.activeUsersLast30Days, 'Signed in during the last 30 days'],
  ];

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span><small>Admin</small></Link>
        <div className={styles.headerActions}>
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

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><p className={styles.eyebrow}>Latest accounts</p><h2>Users</h2></div>
            <span>Showing latest {overview.users.length}</span>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Verification</th><th>Last sign-in</th><th>Joined</th></tr></thead>
              <tbody>
                {overview.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><span className={user.role === 'admin' ? styles.roleAdmin : styles.roleUser}>{user.role === 'admin' ? 'Admin' : 'User'}</span></td>
                    <td><span className={user.verified ? styles.verified : styles.unverified}>{user.verified ? 'Verified' : 'Pending'}</span></td>
                    <td>{formatDate(user.lastLoginAt)}</td>
                    <td>{formatDate(user.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!overview.users.length && <p className={styles.empty}>No users have registered yet.</p>}
          </div>
        </section>

        <section className={styles.nextPanel}>
          <div><p className={styles.eyebrow}>Coming next</p><h2>Billing</h2><p>Trial, paid, failed-payment, and income metrics will appear here when Razorpay is connected.</p></div>
          <span>Not enabled yet</span>
        </section>
      </section>
    </main>
  );
}
