import { authJson, authOptions, authRateLimit } from '@/server/http/auth-response';
import { createPublicClient, normalizeEmail } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const rateLimited = authRateLimit(request, 'auth-password-reset-request', { limit: 5, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  try {
    const { email } = await request.json();
    const cleanEmail = normalizeEmail(email);
    if (cleanEmail && /^\S+@\S+\.\S+$/.test(cleanEmail)) {
      await createPublicClient().collection('users').requestPasswordReset(cleanEmail);
    }
  } catch {
    // Return the same response to prevent account enumeration.
  }
  return authJson(request, { success: true });
}
