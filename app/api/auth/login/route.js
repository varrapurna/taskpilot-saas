import { authJson, authOptions, authRateLimit } from '@/server/http/auth-response';
import { createPublicClient, normalizeEmail, recordSuccessfulLogin, setAuthCookie } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const rateLimited = authRateLimit(request, 'auth-login', { limit: 10, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  let email;
  let auth;

  try {
    const body = await request.json();
    email = normalizeEmail(body.email);
    const { password } = body;
    if (!email || typeof password !== 'string') {
      return authJson(request, { error: 'Enter your email and password.' }, 400);
    }

    const pb = createPublicClient();
    auth = await pb.collection('users').authWithPassword(email, password);
  } catch {
    return authJson(request, { error: 'Incorrect credentials, or verify your email before logging in.' }, 401);
  }

  if (!auth.record.verified) {
    return authJson(request, { error: 'Verify your email before signing in.' }, 401);
  }

  try {
    await recordSuccessfulLogin(auth.record.id);
  } catch (error) {
    console.error('Could not record successful login:', error?.message);
  }

  const response = authJson(request, {
    user: { id: auth.record.id, name: auth.record.name, email: auth.record.email },
  });
  return setAuthCookie(response, auth.token);
}
