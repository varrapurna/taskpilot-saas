import { authJson, authOptions } from '@/server/http/auth-response';
import { getAuthenticatedClient } from '@/server/auth/account';
import { getIntegrationStatusForUser } from '@/server/database/pocketbase';
import { canUseIntegrations } from '@/server/features/integrations';

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  const integrationsAvailable = canUseIntegrations(client.record);
  const integrations = integrationsAvailable
    ? await getIntegrationStatusForUser(client.record.id, client.admin)
    : { taigaConnected: false };
  return authJson(request, {
    user: { id: client.record.id, name: client.record.name, email: client.record.email, role: client.record.role },
    integrations: { taiga: integrations.taigaConnected, mhConnekt: false },
    integrationsAvailable,
  });
}
