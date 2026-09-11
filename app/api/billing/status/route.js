import { getAuthenticatedClient } from '@/server/auth/account';
import { getBillingSummaryForUser } from '@/server/billing/subscriptions';
import { authJson, authOptions } from '@/server/http/auth-response';

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  return authJson(request, { billing: await getBillingSummaryForUser(client.record.id, client.admin) });
}
