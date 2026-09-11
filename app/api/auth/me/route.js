import { authJson, authOptions } from '@/server/http/auth-response';
import { getAuthenticatedClient } from '@/server/auth/account';

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  return authJson(request, {
    user: { id: client.record.id, name: client.record.name, email: client.record.email },
    integrations: { taiga: false, mhConnekt: false },
  });
}
