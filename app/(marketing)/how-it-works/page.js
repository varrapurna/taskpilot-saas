import Link from 'next/link';
import styles from './page.module.css';

const steps = [
  ['01', 'Create your account', 'Use your work email and choose a secure password. We send a verification email before your first sign-in.'],
  ['02', 'Connect your workspace', 'Add your Taiga account once. TaskPilot keeps your work connection ready for WhatsApp.'],
  ['03', 'Work from WhatsApp', 'Send “tasks” to see open Taiga work, then use simple replies to update progress or add a comment.'],
];

export default function HowItWorksPage() {
  return (
    <main className={styles.main}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brand}>Task<span>Pilot</span></Link>
        <div className={styles.navActions}>
          <Link href="/account/login" className={styles.signIn}>Sign in</Link>
          <Link href="/account/signup" className={styles.navCta}>Get started</Link>
        </div>
      </nav>

      <section className={styles.intro}>
        <p>How it works</p>
        <h1>Less switching.<br />More work done.</h1>
        <span>TaskPilot gives you one simple path from account setup to managing Taiga work in WhatsApp.</span>
      </section>

      <section className={styles.steps} aria-label="TaskPilot setup steps">
        {steps.map(([number, title, description]) => (
          <article className={styles.step} key={number}>
            <span className={styles.number}>{number}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className={styles.bottomCta}>
        <div><p>Ready when you are</p><h2>Start managing work with less effort.</h2></div>
        <Link href="/account/signup">Create your account</Link>
      </section>

      <footer className={styles.footer}><Link href="/" className={styles.brand}>Task<span>Pilot</span></Link><span>Work updates, made easier.</span></footer>
    </main>
  );
}
