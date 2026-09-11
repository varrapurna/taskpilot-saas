import { redirect } from 'next/navigation';
import { getAuthenticatedClient } from '@/server/auth/account';

export default async function OnboardLayout({ children }) {
  const client = await getAuthenticatedClient();
  if (!client) redirect('/account/login');
  if (client.record.role === 'admin') redirect('/dashboard');
  return children;
}
