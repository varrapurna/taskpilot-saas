import { getAuthenticatedClient } from '@/server/auth/account';
import { getAdminOverview } from '@/server/admin/overview';
import { getBillingSummaryForUser } from '@/server/billing/subscriptions';
import { getIntegrationStatusForUser } from '@/server/database/pocketbase';
import { getMhConnectionForUser } from '@/server/database/mhconnekt';
import { authJson, authOptions } from '@/server/http/auth-response';
import { canUseIntegrations } from '@/server/features/integrations';

export function OPTIONS(request) { return authOptions(request); }

async function getMhConnectionSafely(userId, pb) {
  try {
    return await getMhConnectionForUser(userId, pb);
  } catch (error) {
    console.warn('MH Connekt status is temporarily unavailable on the dashboard.', {
      status: error?.status,
    });
    return null;
  }
}

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  if (client.record.role === 'admin') {
    const [overview, integrations, mhConnection] = await Promise.all([
      getAdminOverview(),
      getIntegrationStatusForUser(client.record.id, client.admin),
      getMhConnectionSafely(client.record.id, client.admin),
    ]);
    return authJson(request, {
      role: 'admin',
      admin: client.record,
      overview,
      integrations: { ...integrations, mhConnektConnected: Boolean(mhConnection) },
      integrationsAvailable: true,
    });
  }

  const integrationsAvailable = canUseIntegrations(client.record);
  if (!integrationsAvailable) {
    return authJson(request, {
      role: 'user',
      user: client.record,
      integrations: { taigaConnected: false, mhConnektConnected: false },
      billing: null,
      integrationsAvailable: false,
    });
  }

  const [integrations, billing] = await Promise.all([
    getIntegrationStatusForUser(client.record.id, client.admin),
    getBillingSummaryForUser(client.record.id, client.admin),
  ]);

  // The dashboard must remain usable while the optional MH Connekt migration
  // is being rolled out. A missing or temporarily unavailable MH collection
  // means "not connected", not a broken TaskPilot dashboard.
  const mhConnection = await getMhConnectionSafely(client.record.id, client.admin);

  return authJson(request, {
    role: 'user',
    user: client.record,
    integrations: { ...integrations, mhConnektConnected: Boolean(mhConnection) },
    billing,
    integrationsAvailable: true,
  });
}
