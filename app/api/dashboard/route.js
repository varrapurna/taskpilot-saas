import { getAuthenticatedClient } from '@/server/auth/account';
import { getAdminOverview } from '@/server/admin/overview';
import { getBillingSummaryForUser, startTrialForUser } from '@/server/billing/subscriptions';
import { getIntegrationStatusForUser } from '@/server/database/pocketbase';
import { authJson, authOptions } from '@/server/http/auth-response';

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  if (client.record.role === 'admin') {
    return authJson(request, {
      role: 'admin',
      admin: client.record,
      overview: await getAdminOverview(),
    });
  }

  const [integrations] = await Promise.all([
    getIntegrationStatusForUser(client.record.id),
    startTrialForUser(client.record.id),
  ]);
  const billing = await getBillingSummaryForUser(client.record.id);

  return authJson(request, {
    role: 'user',
    user: client.record,
    integrations,
    billing,
  });
}
