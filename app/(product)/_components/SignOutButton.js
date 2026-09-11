'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignOutButton({ className }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/account/login');
      router.refresh();
    }
  }

  return <button className={className} type="button" onClick={signOut} disabled={loading}>{loading ? 'Signing out…' : 'Sign out'}</button>;
}
