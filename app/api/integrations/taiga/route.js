import { getAuthenticatedClient } from '@/server/auth/account';
import { cancelRazorpaySubscriptionForUser, getBillingSummaryForUser } from '@/server/billing/subscriptions';
import { deleteCredentialsForUser, deleteSession, getCredentialsForUser } from '@/server/database/pocketbase';
import { authJson, authOptions } from '@/server/http/auth-response';

function maskedPhone(phone) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (normalized.length < 5) return 'Not available';
  return `+${normalized.slice(0, Math.min(3, normalized.length - 4))} •••• ${normalized.slice(-4)}`;
}

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  try {
    const [credentials, billing] = await Promise.all([
      getCredentialsForUser(client.record.id, client.admin),
      getBillingSummaryForUser(client.record.id, client.admin),
    ]);
    if (!credentials) return authJson(request, { connected: false, billing });

    return authJson(request, {
      connected: true,
      connection: {
        whatsappNumber: maskedPhone(credentials.whatsapp_number),
        taigaUsername: credentials.taiga_username,
        accountEmail: client.record.email,
      },
      billing,
    });
  } catch (error) {
    console.error('Taiga connection details failed.', error?.message);
    return authJson(request, { error: 'We could not load your Taiga connection.' }, 503);
  }
}

export async function DELETE(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  try {
    // Cancel billing first. If Razorpay rejects the request, keep Taiga
    // connected so the customer never loses access while auto-pay remains on.
    const credentials = await getCredentialsForUser(client.record.id, client.admin);
    await cancelRazorpaySubscriptionForUser(client.record.id, client.admin);
    await deleteCredentialsForUser(client.record.id, client.admin);
    if (credentials?.whatsapp_number) {
      try {
        await deleteSession(credentials.whatsapp_number, client.admin);
      } catch (sessionError) {
        console.error('Taiga disconnect session cleanup failed.', sessionError?.message);
      }
    }
    return authJson(request, { success: true });
  } catch (error) {
    console.error('Taiga disconnect failed.', error?.code || error?.message);
    return authJson(request, {
      error: 'We could not cancel your auto-pay, so your Taiga connection is still active. Please try again.',
    }, 502);
  }
}
