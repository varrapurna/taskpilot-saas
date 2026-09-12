import { authJson, authOptions, authRateLimit } from '@/server/http/auth-response';
import { createPublicClient, validatePassword } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const rateLimited = authRateLimit(request, 'auth-password-reset-confirm', { limit: 10, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  try {
    const { token, password } = await request.json();
    if (typeof token !== 'string' || !validatePassword(password)) {
      return authJson(request, { error: 'Use a valid reset link and a password with at least 12 characters.' }, 400);
    }
    await createPublicClient().collection('users').confirmPasswordReset(token, password, password);
    return authJson(request, { success: true });
  } catch {
    return authJson(request, { error: 'This reset link is invalid or has expired.' }, 400);
  }
}
