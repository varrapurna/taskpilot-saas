import { getAuthenticatedClient, verifyCurrentPassword } from '@/server/auth/account';
import { authJson, authOptions, authRateLimit, requireTrustedOrigin } from '@/server/http/auth-response';
import { connectMhConnekt, updateMhConnektConnection } from '@/server/integrations/mhconnekt';
import { deleteMhConnectionForUser, getMhConnectionForUser } from '@/server/database/mhconnekt';
import { cancelRazorpaySubscriptionForUser, getBillingSubscription, getBillingSummaryForUser } from '@/server/billing/subscriptions';
import { getCredentialsForUser } from '@/server/database/pocketbase';

function phone(value) { return typeof value === 'string' ? value.trim().replace(/^\+/, '') : ''; }
function email(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }

export function OPTIONS(request) { return authOptions(request); }

export async function GET(request) {
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);
  try {
    const [connection, billing] = await Promise.all([
      getMhConnectionForUser(client.record.id, client.admin),
      getBillingSummaryForUser(client.record.id, client.admin),
    ]);
    return authJson(request, {
      connected: Boolean(connection),
      connection: connection ? {
        email: connection.mh_email.replace(/^(.{2}).*(@.*)$/, '$1•••$2'),
        whatsappNumber: `+${connection.whatsapp_number.slice(0, 3)}••••${connection.whatsapp_number.slice(-4)}`,
        accountEmail: client.record.email,
      } : null,
      billing,
    });
  } catch (error) {
    console.warn('MH Connekt status is unavailable.', { status: error?.status });
    return authJson(request, { error: 'We could not load your MH Connekt connection.' }, 503);
  }
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
    const currentTaskPilotPassword = typeof body.currentTaskPilotPassword === 'string' ? body.currentTaskPilotPassword : '';
    if (!/^\d{7,20}$/.test(whatsappNumber)) return authJson(request, { error: 'Enter a valid WhatsApp number with country code.' }, 400);
    if (!/^\S+@\S+\.\S+$/.test(mhEmail) || password.length < 1 || password.length > 1024) return authJson(request, { error: 'Enter your MH Connekt email and password.' }, 400);
    const existingConnection = await getMhConnectionForUser(client.record.id, client.admin);
    if (existingConnection && !(await verifyCurrentPassword(client.record, currentTaskPilotPassword))) {
      return authJson(request, { error: 'Your current TaskPilot password is not correct.' }, 400);
    }
    await connectMhConnekt({ userId: client.record.id, phone: whatsappNumber, email: mhEmail, password, pb: client.admin });
    return authJson(request, { success: true });
  } catch (error) {
    const errorCode = error?.code
      || (/ENCRYPTION_MASTER_KEY/.test(error?.message || '') ? 'MH_SECURE_STORAGE_NOT_READY' : '')
      || (error?.status === 404 ? 'MH_STORAGE_NOT_READY' : '');
    console.error('MH Connekt connection failed.', {
      code: errorCode,
      status: error?.providerStatus || error?.status,
      message: String(error?.message || '').slice(0, 200),
    });
    const messages = {
      MH_LOGIN_REJECTED: 'Could not sign in to MH Connekt. Check your email and password.',
      MH_UNAVAILABLE: 'MH Connekt is temporarily unavailable. Please try again shortly.',
      MH_STORAGE_NOT_READY: 'MH Connekt is still being set up on TaskPilot. Please try again shortly.',
      MH_SECURE_STORAGE_NOT_READY: 'Secure MH Connekt storage is not ready. Please contact TaskPilot support.',
      WHATSAPP_ALREADY_CONNECTED: error.message,
    };
    return authJson(request, { error: messages[errorCode] || 'We could not connect MH Connekt. Please try again.' }, errorCode === 'WHATSAPP_ALREADY_CONNECTED' ? 409 : errorCode === 'MH_LOGIN_REJECTED' ? 400 : 503);
  }
}

export async function PATCH(request) {
  const rejected = requireTrustedOrigin(request); if (rejected) return rejected;
  const limited = authRateLimit(request, 'mhconnekt-connection-update', { limit: 5, windowMs: 15 * 60 * 1000 }); if (limited) return limited;
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please sign in before updating MH Connekt.' }, 401);

  try {
    const body = await request.json();
    const requestedPhone = phone(body.phone);
    const requestedEmail = typeof body.email === 'string' ? email(body.email) : '';
    const requestedPassword = typeof body.password === 'string' ? body.password : '';
    const currentTaskPilotPassword = typeof body.currentTaskPilotPassword === 'string' ? body.currentTaskPilotPassword : '';
    if (requestedPhone && !/^\d{7,20}$/.test(requestedPhone)) return authJson(request, { error: 'Enter a valid WhatsApp number with country code.' }, 400);
    if (requestedEmail && !/^\S+@\S+\.\S+$/.test(requestedEmail)) return authJson(request, { error: 'Enter a valid MH Connekt email.' }, 400);
    if (requestedPassword.length > 1024) return authJson(request, { error: 'MH Connekt password is too long.' }, 400);
    if (!requestedPhone && !requestedEmail && !requestedPassword) return authJson(request, { error: 'Enter at least one new MH Connekt detail to update.' }, 400);
    if (!(await verifyCurrentPassword(client.record, currentTaskPilotPassword))) return authJson(request, { error: 'Your current TaskPilot password is not correct.' }, 400);

    const connection = await getMhConnectionForUser(client.record.id, client.admin);
    if (!connection) return authJson(request, { error: 'No MH Connekt connection exists for this account.' }, 404);
    await updateMhConnektConnection({
      connection,
      phone: requestedPhone,
      email: requestedEmail,
      password: requestedPassword,
      pb: client.admin,
    });
    return authJson(request, { success: true });
  } catch (error) {
    console.error('MH Connekt connection update failed.', { code: error?.code, status: error?.providerStatus || error?.status, message: String(error?.message || '').slice(0, 200) });
    const messages = {
      MH_LOGIN_REJECTED: 'Could not connect to MH Connekt. Check the new email and password.',
      MH_UNAVAILABLE: 'MH Connekt is temporarily unavailable. Please try again shortly.',
      MH_PASSWORD_REQUIRED: error.message,
      WHATSAPP_ALREADY_CONNECTED: error.message,
    };
    const code = error?.code;
    return authJson(request, { error: messages[code] || 'We could not update your MH Connekt connection. Please try again.' }, ['MH_LOGIN_REJECTED', 'MH_PASSWORD_REQUIRED'].includes(code) ? 400 : code === 'WHATSAPP_ALREADY_CONNECTED' ? 409 : 503);
  }
}

export async function DELETE(request) {
  const rejected = requireTrustedOrigin(request); if (rejected) return rejected;
  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);
  try {
    const taigaCredentials = await getCredentialsForUser(client.record.id, client.admin);
    if (!taigaCredentials) await cancelRazorpaySubscriptionForUser(client.record.id, client.admin);
    await deleteMhConnectionForUser(client.record.id, client.admin);
    return authJson(request, { success: true });
  } catch (error) {
    console.error('MH Connekt disconnect failed.', error?.code || error?.message);
    return authJson(request, { error: 'We could not safely update your subscription, so your MH Connekt connection is still active. Please try again.' }, 502);
  }
}
