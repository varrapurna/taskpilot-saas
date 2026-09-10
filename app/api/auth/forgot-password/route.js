import { authJson, authOptions } from '@/lib/auth-response';
import { createPublicClient, normalizeEmail } from '@/lib/client-auth';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
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
