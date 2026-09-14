'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import SignOutButton from '../_components/SignOutButton';
import styles from './onboard.module.css';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

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
    href: '/onboard/mhconnekt',
    action: 'Connect MH Connekt',
    status: 'Available',
    available: true,
    tone: 'mhConnekt',
  },
];

export default function OnboardPage() {
  const [taigaConnected, setTaigaConnected] = useState(null);
  const [mhConnected, setMhConnected] = useState(null);
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
  const resumeLink = waNumber ? `https://wa.me/${waNumber}?text=hi` : '/manage/taiga';

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/dashboard`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Could not load integration status.');
        return Boolean(body.integrations?.taigaConnected);
      })
      .then((connected) => active && setTaigaConnected(connected))
      .catch(() => active && setTaigaConnected(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/integrations/mhconnekt`, { credentials: 'include' })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => { if (!response.ok) throw new Error(body.error); if (active) setMhConnected(Boolean(body.connected)); })
      .catch(() => active && setMhConnected(false));
    return () => { active = false; };
  }, []);

  const displayedIntegrations = integrations.map((integration) => {
    if (integration.name === 'MH Connekt' && mhConnected === true) return {
      ...integration,
      description: 'Your MH Connekt account is connected. Open WhatsApp to manage your timesheet.',
      href: resumeLink,
      action: 'Resume MH work',
      status: 'Connected',
      connected: true,
    };
    if (integration.name !== 'Taiga' || taigaConnected !== true) return integration;
    return {
      ...integration,
      description: 'Your Taiga workspace is connected. Resume your work in WhatsApp or manage this connection.',
      href: resumeLink,
      action: 'Resume Taiga work',
      status: 'Connected',
      connected: true,
    };
  });

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
          {displayedIntegrations.map((integration) => (
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
                  <span className={integration.connected ? styles.connectedBadge : integration.available ? styles.availableBadge : styles.nextBadge}>
                    {integration.status}
                  </span>
                </div>
                <p>{integration.description}</p>

                {integration.available ? (
                  <div className={styles.integrationActions}>
                  <Link href={integration.href} target={integration.connected && waNumber ? '_blank' : undefined} rel={integration.connected && waNumber ? 'noopener noreferrer' : undefined} className={styles.connectButton}>
                    {integration.action}
                    <span aria-hidden="true">→</span>
                  </Link>
                  {integration.connected && integration.name === 'Taiga' && <Link href="/manage/taiga" className={styles.manageLink}>Manage Taiga connection</Link>}
                  {integration.connected && integration.name === 'MH Connekt' && <Link href="/onboard/mhconnekt" className={styles.manageLink}>Manage MH Connekt connection</Link>}
                  </div>
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
