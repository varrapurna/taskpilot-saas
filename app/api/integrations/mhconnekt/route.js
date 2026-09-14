import { getAuthenticatedClient } from '@/server/auth/account';
import { authJson, authOptions, authRateLimit, requireTrustedOrigin } from '@/server/http/auth-response';
import { connectMhConnekt } from '@/server/integrations/mhconnekt';
import { deleteMhConnectionForUser, getMhConnectionForUser } from '@/server/database/mhconnekt';
import { getBillingSubscription } from '@/server/billing/subscriptions';

function phone(value) { return typeof value === 'string' ? value.trim().replace(/^\+/, '') : ''; }
function email(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);
  const connection = await getMhConnectionForUser(client.record.id, client.admin);
  return authJson(request, { connected: Boolean(connection), connection: connection ? { email: connection.mh_email.replace(/^(.{2}).*(@.*)$/, '$1•••$2'), whatsappNumber: `+${connection.whatsapp_number.slice(0, 3)}••••${connection.whatsapp_number.slice(-4)}` } : null });
}

export async function POST(request) {
  const rejected = requireTrustedOrigin(request); if (rejected) return rejected;
  const limited = authRateLimit(request, 'mhconnekt-connect', { limit: 5, windowMs: 15 * 60 * 1000 }); if (limited) return limited;
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please sign in before connecting MH Connekt.' }, 401);
  try {
    const billing = await getBillingSubscription(client.record.id, client.admin);
    if (!billing?.razorpay_autopay_accepted) {
      return authJson(request, { error: 'Set up and approve your ₹100/month auto-pay before connecting MH Connekt.' }, 402);
    }
    const body = await request.json();
    const whatsappNumber = phone(body.phone); const mhEmail = email(body.email); const password = typeof body.password === 'string' ? body.password : '';
    if (!/^\d{7,20}$/.test(whatsappNumber)) return authJson(request, { error: 'Enter a valid WhatsApp number with country code.' }, 400);
    if (!/^\S+@\S+\.\S+$/.test(mhEmail) || password.length < 1 || password.length > 1024) return authJson(request, { error: 'Enter your MH Connekt email and password.' }, 400);
    await connectMhConnekt({ userId: client.record.id, phone: whatsappNumber, email: mhEmail, password, pb: client.admin });
    return authJson(request, { success: true });
  } catch (error) {
    console.error('MH Connekt connection failed.', { code: error?.code, status: error?.providerStatus });
    const messages = { MH_LOGIN_REJECTED: 'Could not sign in to MH Connekt. Check your email and password.', MH_UNAVAILABLE: 'MH Connekt is temporarily unavailable. Please try again shortly.', WHATSAPP_ALREADY_CONNECTED: error.message };
    return authJson(request, { error: messages[error?.code] || 'We could not connect MH Connekt. Please try again.' }, error?.code === 'WHATSAPP_ALREADY_CONNECTED' ? 409 : error?.code === 'MH_LOGIN_REJECTED' ? 400 : 503);
  }
}

export async function DELETE(request) {
  const rejected = requireTrustedOrigin(request); if (rejected) return rejected;
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);
  await deleteMhConnectionForUser(client.record.id, client.admin);
  return authJson(request, { success: true });
}
