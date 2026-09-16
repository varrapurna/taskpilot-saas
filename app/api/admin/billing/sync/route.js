import { getAuthenticatedClient } from '@/server/auth/account';
import { syncRazorpayBillingHistory } from '@/server/billing/subscriptions';
import { authJson, authOptions, authRateLimit, requireTrustedOrigin } from '@/server/http/auth-response';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const csrfRejected = requireTrustedOrigin(request);
  if (csrfRejected) return csrfRejected;

  const rateLimited = authRateLimit(request, 'admin-billing-history-sync', { limit: 3, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);
  if (client.record.role !== 'admin') return authJson(request, { error: 'Admin access is required.' }, 403);

  try {
    return authJson(request, { success: true, ...(await syncRazorpayBillingHistory()) });
  } catch (error) {
    console.error('Razorpay billing history sync failed.', {
      status: error?.providerStatus || error?.status,
      message: error?.message,
    });
    return authJson(request, { error: 'Razorpay history could not be synced. Check the billing configuration and try again.' }, 503);
  }
}
