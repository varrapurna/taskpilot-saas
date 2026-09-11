import Image from 'next/image';
import Link from 'next/link';
import SignOutButton from '../_components/SignOutButton';
import styles from './onboard.module.css';

const integrations = [
  {
    name: 'Taiga',
    description: 'View tasks, post comments, and update task or story statuses from WhatsApp.',
    image: '/integrations/taiga-mark.png',
    imageAlt: 'Taiga',
    imageClassName: styles.taigaLogo,
    href: '/onboard/taiga',
    action: 'Connect Taiga',
    status: 'Available',
    available: true,
    tone: 'taiga',
  },
  {
    name: 'MH Connekt',
    description: 'View assigned projects and prepare daily timesheet activities from WhatsApp.',
    image: '/integrations/mhconnekt-logo.png',
    imageAlt: 'MH Connekt',
    imageClassName: styles.mhConnektLogo,
    action: 'Setup coming next',
    status: 'Next integration',
    available: false,
    tone: 'mhConnekt',
  },
];

export default function OnboardPage() {
  return (
    <main className={styles.selectorMain}>
      <header className={styles.selectorHeader}>
        <Link href="/dashboard" className={styles.brand}>Task<span>Pilot</span></Link>
        <div className={styles.setupHeaderActions}>
          <Link href="/dashboard" className={styles.headerLink}>Dashboard</Link>
          <SignOutButton className={styles.signOut} />
        </div>
      </header>

      <section className={styles.selectorShell}>
        <div className={styles.selectorIntro}>
          <span className={styles.eyebrow}>Connect your workspace</span>
          <h1>Choose the tools you use</h1>
          <p>
            Connect one or both. When both are active, TaskPilot will ask which workspace
            you want to use in WhatsApp.
          </p>
        </div>

        <div className={styles.integrationGrid}>
          {integrations.map((integration) => (
            <article className={`${styles.integrationCard} ${integration.tone === 'taiga' ? styles.taigaFeature : styles.mhConnektFeature}`} key={integration.name}>
              <div className={styles.logoPanel}>
                <Image
                  src={integration.image}
                  alt={integration.imageAlt}
                  width={integration.name === 'Taiga' ? 192 : 968}
                  height={integration.name === 'Taiga' ? 192 : 247}
                  className={integration.imageClassName}
                />
              </div>

              <div className={styles.integrationBody}>
                <div className={styles.cardTitleRow}>
                  <h2>{integration.name}</h2>
                  <span className={integration.available ? styles.availableBadge : styles.nextBadge}>
                    {integration.status}
                  </span>
                </div>
                <p>{integration.description}</p>

                {integration.available ? (
                  <Link href={integration.href} className={styles.connectButton}>
                    {integration.action}
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <button className={styles.disabledButton} type="button" disabled>
                    {integration.action}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <p className={styles.selectorNote}>
          Your account credentials will be encrypted and handled only by the TaskPilot backend.
        </p>
      </section>
    </main>
  );
}
