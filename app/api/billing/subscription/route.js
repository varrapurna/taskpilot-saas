import { getAuthenticatedClient } from '@/server/auth/account';
import { createRazorpaySubscriptionForUser } from '@/server/billing/subscriptions';
import { authJson, authOptions } from '@/server/http/auth-response';

export function OPTIONS(request) { return authOptions(request); }

export async function POST(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  try {
    const checkout = await createRazorpaySubscriptionForUser(client.record);
    return authJson(request, { checkout });
  } catch (error) {
    if (error?.code === 'BILLING_NOT_CONFIGURED') {
      return authJson(request, { error: 'Billing is not available yet.' }, 503);
    }
    console.error('Billing subscription error:', error?.code || error?.message);
    return authJson(request, { error: 'We could not start billing. Please try again.' }, 502);
  }
}
