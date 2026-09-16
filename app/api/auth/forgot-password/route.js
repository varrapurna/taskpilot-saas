import { authJson, authOptions, authRateLimit } from '@/server/http/auth-response';
import { createPublicClient, normalizeEmail } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  try {
    const { email } = await request.json();
    const cleanEmail = normalizeEmail(email);
    if (cleanEmail && /^\S+@\S+\.\S+$/.test(cleanEmail)) {
      const networkLimited = authRateLimit(request, 'auth-password-reset-network', { limit: 30, windowMs: 15 * 60 * 1000 });
      if (networkLimited) return networkLimited;
      const emailLimited = authRateLimit(request, 'auth-password-reset-email', { limit: 3, windowMs: 15 * 60 * 1000, key: cleanEmail });
      if (emailLimited) return emailLimited;
      await createPublicClient().collection('users').requestPasswordReset(cleanEmail);
    }
  } catch (error) {
    // Return the same response to prevent account enumeration.
    console.error('Password reset email request failed.', {
      status: error?.status || error?.response?.status,
      code: error?.response?.data?.code || error?.code,
    });
  }
  return authJson(request, { success: true });
}
