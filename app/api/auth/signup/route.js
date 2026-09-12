import { authJson, authOptions, authRateLimit } from '@/server/http/auth-response';
import { createClientAccount, normalizeEmail, validatePassword } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const rateLimited = authRateLimit(request, 'auth-signup', { limit: 5, windowMs: 60 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  try {
    const { name, email, password } = await request.json();
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = normalizeEmail(email);

    if (!cleanName || cleanName.length > 100 || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return authJson(request, { error: 'Enter your name and a valid email address.' }, 400);
    }
    if (!validatePassword(password)) {
      return authJson(request, { error: 'Use a password with at least 12 characters.' }, 400);
    }

    await createClientAccount({ name: cleanName, email: cleanEmail, password });
    return authJson(request, { success: true }, 201);
  } catch (error) {
    const emailError = error?.response?.data?.data?.email || error?.response?.data?.email;
    if (emailError?.code === 'validation_not_unique' || emailError?.message) {
      return authJson(request, { error: 'An account with this email already exists.' }, 409);
    }
    console.error('Signup error:', error?.message);
    return authJson(request, { error: 'We could not create your account. Please try again.' }, 500);
  }
}
