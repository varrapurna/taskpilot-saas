'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const isLocalBrowser = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export default function SignOutButton({ className }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/account/login');
      router.refresh();
    }
  }

  return <button className={className} type="button" onClick={signOut} disabled={loading}>{loading ? 'Signing out…' : 'Sign out'}</button>;
}
