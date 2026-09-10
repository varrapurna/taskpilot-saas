import { authJson, authOptions } from '@/lib/auth-response';
import { clearAuthCookie } from '@/lib/client-auth';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  return clearAuthCookie(authJson(request, { success: true }));
}
