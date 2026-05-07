import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1>📋 TaskPilot</h1>
        <p className={styles.tagline}>
          Manage your Taiga tasks directly from WhatsApp — no app switching needed.
        </p>
        <ul className={styles.features}>
          <li>✅ View all your open tasks instantly</li>
          <li>💬 Post AI-enhanced comments in seconds</li>
          <li>🔄 Change task and story statuses on the go</li>
          <li>📅 See deadlines and days remaining at a glance</li>
        </ul>
        <Link href="/onboard" className={styles.ctaButton}>
          Get Started — Connect Your Taiga Account
        </Link>
        <p className={styles.howto}>
          Already registered? Just send <strong>tasks</strong> to{' '}
          <strong>{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}</strong> on WhatsApp.
        </p>
      </div>
    </main>
  );
}
