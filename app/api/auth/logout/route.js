import { authJson, authOptions, requireTrustedOrigin } from '@/server/http/auth-response';
import { clearAuthCookie } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const csrfRejected = requireTrustedOrigin(request);
  if (csrfRejected) return csrfRejected;

  return clearAuthCookie(authJson(request, { success: true }));
}
