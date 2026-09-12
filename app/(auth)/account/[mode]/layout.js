import { notFound } from 'next/navigation';

const ACCOUNT_MODES = new Set(['login', 'signup', 'forgot', 'reset', 'verify']);

export default async function AccountModeLayout({ children, params }) {
  const { mode } = await params;
  if (!ACCOUNT_MODES.has(mode)) notFound();
  return children;
}
