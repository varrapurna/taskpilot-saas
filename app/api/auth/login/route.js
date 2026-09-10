import { authJson, authOptions } from '@/lib/auth-response';
import { createPublicClient, normalizeEmail, setAuthCookie } from '@/lib/client-auth';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || typeof password !== 'string') {
      return authJson(request, { error: 'Enter your email and password.' }, 400);
    }

    const pb = createPublicClient();
    const auth = await pb.collection('users').authWithPassword(cleanEmail, password);
    const response = authJson(request, {
      user: { id: auth.record.id, name: auth.record.name, email: auth.record.email },
    });
    return setAuthCookie(response, auth.token);
  } catch {
    return authJson(request, { error: 'Incorrect credentials, or verify your email before logging in.' }, 401);
  }
}
