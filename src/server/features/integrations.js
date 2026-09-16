import { createAdminClient } from '@/server/database/pocketbase';
import { authJson } from '@/server/http/auth-response';

const INTEGRATIONS_ENABLED_VALUE = 'true';

export function publicIntegrationsEnabled() {
  return process.env.TASKPILOT_INTEGRATIONS_ENABLED === INTEGRATIONS_ENABLED_VALUE;
}

export function canUseIntegrations(user) {
  return user?.role === 'admin' || publicIntegrationsEnabled();
}

export function integrationsLockedResponse(request) {
  return authJson(request, {
    error: 'Connections are not available during the Phase 1 launch.',
    code: 'INTEGRATIONS_LOCKED',
  }, 403);
}

export async function canUserIdUseIntegrations(userId) {
  if (!userId) return false;
  const pb = await createAdminClient();
  const user = await pb.collection('users').getOne(userId);
  return canUseIntegrations(user);
}
