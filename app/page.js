import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1>📋 TaskPilot</h1>
        <p className={styles.tagline}>
          Manage work across Taiga and MH Connekt directly from WhatsApp.
        </p>
        <ul className={styles.features}>
          <li>✅ Choose the workspace you want to use</li>
          <li>💬 Post AI-enhanced comments in seconds</li>
          <li>🔄 Change task and story statuses on the go</li>
          <li>🕒 Prepare project timesheet activities</li>
        </ul>
        <Link href="/onboard" className={styles.ctaButton}>
          Get Started — Connect Your Work Tools
        </Link>
        <p className={styles.howto}>
          Already registered? Just send <strong>tasks</strong> to{' '}
          <strong>{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}</strong> on WhatsApp.
        </p>
      </div>
    </main>
  );
}
