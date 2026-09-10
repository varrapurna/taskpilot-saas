import { authJson, authOptions } from '@/lib/auth-response';
import { createClientAccount, normalizeEmail, validatePassword } from '@/lib/client-auth';

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

    await createClientAccount({ name: cleanName, email: cleanEmail, password });
    return authJson(request, { success: true }, 201);
  } catch (error) {
    const message = error?.response?.data?.email?.message;
    if (message) return authJson(request, { error: 'An account with this email already exists.' }, 409);
    console.error('Signup error:', error?.message);
    return authJson(request, { error: 'We could not create your account. Please try again.' }, 500);
  }
}
