import { authJson, authOptions } from '@/server/http/auth-response';
import { clearAuthCookie } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  return clearAuthCookie(authJson(request, { success: true }));
}
