import { authJson, authOptions, authRateLimit } from '@/server/http/auth-response';
import { createClientAccount, normalizeEmail, validatePassword } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
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

    // A shared home, office, or mobile network must not stop different people
    // from registering. Keep a broad network limit plus a tighter per-email
    // limit to prevent account creation abuse.
    const networkLimited = authRateLimit(request, 'auth-signup-network', { limit: 25, windowMs: 60 * 60 * 1000 });
    if (networkLimited) return networkLimited;
    const emailLimited = authRateLimit(request, 'auth-signup-email', { limit: 3, windowMs: 60 * 60 * 1000, key: cleanEmail });
    if (emailLimited) return emailLimited;

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
