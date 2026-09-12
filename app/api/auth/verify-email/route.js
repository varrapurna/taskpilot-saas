import { authJson, authOptions, authRateLimit } from '@/server/http/auth-response';
import { createPublicClient } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const rateLimited = authRateLimit(request, 'auth-email-verification', { limit: 10, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  try {
    const { token } = await request.json();
    if (typeof token !== 'string') return authJson(request, { error: 'Invalid verification link.' }, 400);
    await createPublicClient().collection('users').confirmVerification(token);
    return authJson(request, { success: true });
  } catch {
    return authJson(request, { error: 'This verification link is invalid or has expired.' }, 400);
  }
}
