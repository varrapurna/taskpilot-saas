import { getAuthenticatedClient } from '@/server/auth/account';
import { getAdminOverview } from '@/server/admin/overview';
import { getBillingSummaryForUser } from '@/server/billing/subscriptions';
import { getIntegrationStatusForUser } from '@/server/database/pocketbase';
import { getMhConnectionForUser } from '@/server/database/mhconnekt';
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

  const [integrations, billing] = await Promise.all([
    getIntegrationStatusForUser(client.record.id, client.admin),
    getBillingSummaryForUser(client.record.id, client.admin),
  ]);

  // The dashboard must remain usable while the optional MH Connekt migration
  // is being rolled out. A missing or temporarily unavailable MH collection
  // means "not connected", not a broken TaskPilot dashboard.
  let mhConnection = null;
  try {
    mhConnection = await getMhConnectionForUser(client.record.id, client.admin);
  } catch (error) {
    console.warn('MH Connekt status is temporarily unavailable on the dashboard.', {
      status: error?.status,
    });
  }

  return authJson(request, {
    role: 'user',
    user: client.record,
    integrations: { ...integrations, mhConnektConnected: Boolean(mhConnection) },
    billing,
  });
}
