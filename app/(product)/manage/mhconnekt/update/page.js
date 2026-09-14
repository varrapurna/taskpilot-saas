import MhConnektUpdateClient from './MhConnektUpdateClient';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

function apiBaseUrl(requestHeaders) {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
  const host = requestHeaders.get('host');
  return host ? `${protocol}://${host}` : '';
}

export default async function UpdateMhConnektPage() {
  const requestHeaders = await headers();
  const baseUrl = apiBaseUrl(requestHeaders);
  const cookie = requestHeaders.get('cookie') || '';

  try {
    const response = await fetch(`${baseUrl}/api/integrations/mhconnekt`, {
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 401) redirect('/account/login');
    if (response.ok && !body.connected) redirect('/onboard/mhconnekt');
    if (response.ok && body.connection) return <MhConnektUpdateClient initialConnection={body.connection} />;
  } catch {
    // Keep the browser retry state when the server cannot reach the API.
  }

  return <MhConnektUpdateClient />;
}
