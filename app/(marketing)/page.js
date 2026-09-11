import Link from 'next/link';
import styles from './page.module.css';

const capabilities = [
  ['Taiga tasks', 'See open work, update status, and add comments from WhatsApp.'],
  ['Smart replies', 'Turn a quick message into a clear work update in seconds.'],
  ['MH Connekt', 'Prepare timesheet activity from the same workspace when it is connected.'],
];

export default function Home() {
  return (
    <main className={styles.main}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brand}>
          Task<span>Pilot</span>
          <small>Work management in WhatsApp</small>
        </Link>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Work management, inside WhatsApp</p>
          <h1>Bring your work together, simply.</h1>
          <p className={styles.lead}>
            Bring Taiga tasks and work updates into WhatsApp. Update work, add comments, and keep your team moving without switching apps.
          </p>
          <div className={styles.heroActions}>
            <Link href="/account/signup" className={styles.primaryCta}>Create your account</Link>
            <Link href="/account/login" className={styles.secondaryCta}>I already have an account</Link>
          </div>
        </div>
        <div className={styles.heroArt} aria-hidden="true" />
      </section>

      <section className={styles.features} aria-label="What TaskPilot does">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>One simple workspace</p>
          <h2>Everything you need to keep work moving.</h2>
        </div>
        <div className={styles.featureGrid}>
          {capabilities.map(([title, description], index) => (
            <article className={styles.featureCard} key={title}>
              <span className={styles.featureNumber}>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <span className={styles.brand}>Task<span>Pilot</span></span>
        <span>Work updates, made easier.</span>
      </footer>
    </main>
  );
}
