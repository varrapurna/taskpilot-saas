import { getAdminOverview } from '@/server/admin/overview';
import { getAuthenticatedClient } from '@/server/auth/account';
import { authJson, authOptions } from '@/server/http/auth-response';

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);
  if (client.record.role !== 'admin') {
    return authJson(request, { error: 'Admin access is required.' }, 403);
  }

  return authJson(request, await getAdminOverview());
}
