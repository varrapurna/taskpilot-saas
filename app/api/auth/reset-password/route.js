import { authJson, authOptions } from '@/lib/auth-response';
import { createPublicClient, validatePassword } from '@/lib/client-auth';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
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
