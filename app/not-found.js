import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>Task<span>Pilot</span></Link>
      </header>
      <section className={styles.content}>
        <p className={styles.eyebrow}>Page not found</p>
        <div className={styles.code}>404</div>
        <h1>This page is not available.</h1>
        <p>The link may be old, or you may not have access to this area of TaskPilot.</p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>Go to TaskPilot</Link>
          <Link href="/account/login" className={styles.secondary}>Sign in</Link>
        </div>
      </section>
    </main>
  );
}
