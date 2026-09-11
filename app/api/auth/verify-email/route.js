import { authJson, authOptions } from '@/server/http/auth-response';
import { createPublicClient } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (typeof token !== 'string') return authJson(request, { error: 'Invalid verification link.' }, 400);
    await createPublicClient().collection('users').confirmVerification(token);
    return authJson(request, { success: true });
  } catch {
    return authJson(request, { error: 'This verification link is invalid or has expired.' }, 400);
  }
}
