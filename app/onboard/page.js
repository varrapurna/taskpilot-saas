import Image from 'next/image';
import Link from 'next/link';
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
  },
];

export default function OnboardPage() {
  return (
    <main className={styles.selectorMain}>
      <section className={styles.selectorShell}>
        <Link href="/" className={styles.brand}>TaskPilot</Link>

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
            <article className={styles.integrationCard} key={integration.name}>
              <div className={`${styles.logoPanel} ${!integration.available ? styles.darkLogoPanel : ''}`}>
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
