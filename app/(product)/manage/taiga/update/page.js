import TaigaUpdateClient from './TaigaUpdateClient';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

function apiBaseUrl(requestHeaders) {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
  const host = requestHeaders.get('host');
  return host ? `${protocol}://${host}` : '';
}

export default async function UpdateTaigaPage() {
  const requestHeaders = await headers();
  const baseUrl = apiBaseUrl(requestHeaders);
  const cookie = requestHeaders.get('cookie') || '';

  try {
    const response = await fetch(`${baseUrl}/api/integrations/taiga`, {
      headers: cookie ? { cookie } : undefined,
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 401) redirect('/account/login');
    if (response.ok && !body.connected) redirect('/onboard/taiga');
    if (response.ok && body.connection) return <TaigaUpdateClient initialConnection={body.connection} />;
  } catch {
    // The client keeps its existing retryable error state if the server cannot reach the API.
  }

  return <TaigaUpdateClient />;
}
