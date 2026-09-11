import { authJson, authOptions } from '@/server/http/auth-response';
import { getAuthenticatedClient } from '@/server/auth/account';
import { getIntegrationStatusForUser } from '@/server/database/pocketbase';

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  const integrations = await getIntegrationStatusForUser(client.record.id, client.admin);
  return authJson(request, {
    user: { id: client.record.id, name: client.record.name, email: client.record.email, role: client.record.role },
    integrations: { taiga: integrations.taigaConnected, mhConnekt: false },
  });
}
