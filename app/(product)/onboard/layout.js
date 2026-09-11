'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function OnboardLayout({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          router.replace('/account/login');
          return;
        }
        if (body.user?.role === 'admin') {
          router.replace('/dashboard');
          return;
        }
        if (active) setReady(true);
      })
      .catch(() => router.replace('/account/login'));

    return () => { active = false; };
  }, [router]);

  return ready ? children : null;
}
