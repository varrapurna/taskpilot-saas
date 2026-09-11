import Link from 'next/link';
import styles from './dashboard.module.css';

export default async function DashboardPage({ searchParams }) {
  const { phone = '', name = 'there' } = await searchParams;

  const waLink = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '')}?text=tasks`;

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.successBadge}>✅ You&apos;re all set!</div>
        <h1>Welcome, {decodeURIComponent(name)}!</h1>
        <p className={styles.subtitle}>
          Your Taiga account is connected. You can now manage your tasks from WhatsApp.
        </p>

        <div className={styles.infoBox}>
          <h2>📱 Start using TaskPilot</h2>
          <p>Send a WhatsApp message to:</p>
          <div className={styles.phoneNumber}>{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}</div>
          <p>Type <strong>tasks</strong> to see your open Taiga tasks.</p>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.waButton}>
            💬 Open WhatsApp Chat
          </a>
        </div>

        <div className={styles.commandsBox}>
          <h2>📖 Commands</h2>
          <ul>
            <li><strong>tasks</strong> — Load your open tasks</li>
            <li><strong>1</strong> — Post a comment on current task</li>
            <li><strong>2</strong> — Change task or story status</li>
            <li><strong>3</strong> — Next task</li>
            <li><strong>4</strong> — Previous task</li>
            <li><strong>pre</strong> — Use a pre-loaded comment template</li>
            <li><strong>end</strong> — End the session</li>
            <li><strong>0</strong> — Go back (from any sub-menu)</li>
          </ul>
        </div>

        {phone && (
          <p className={styles.phoneNote}>
            Registered number: <strong>+{phone}</strong>
          </p>
        )}

        <Link href="/onboard" className={styles.updateLink}>
          Update Taiga credentials
        </Link>
      </div>
    </main>
  );
}
