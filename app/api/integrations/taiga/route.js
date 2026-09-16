import { getAuthenticatedClient, verifyCurrentPassword } from '@/server/auth/account';
import { cancelRazorpaySubscriptionForUser, getBillingSummaryForUser } from '@/server/billing/subscriptions';
import { deleteCredentialsForUser, deleteSession, getCredentialsForUser, saveSession, updateCredentialsForUser } from '@/server/database/pocketbase';
import { getMhConnectionForUser } from '@/server/database/mhconnekt';
import { decrypt, encrypt } from '@/server/security/crypto';
import { authJson, authOptions, authRateLimit, requireTrustedOrigin } from '@/server/http/auth-response';
import axios from 'axios';

const TAIGA_API_BASE_URL = 'https://api.taiga.io/api/v1';

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
  const csrfRejected = requireTrustedOrigin(request);
  if (csrfRejected) return csrfRejected;

  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  try {
    const [credentials, mhConnection] = await Promise.all([
      getCredentialsForUser(client.record.id, client.admin),
      getMhConnectionForUser(client.record.id, client.admin),
    ]);
    // A TaskPilot plan covers both workspaces. Only stop renewal after the
    // final workspace is disconnected; a paid month remains usable until its
    // current period ends.
    if (!mhConnection) await cancelRazorpaySubscriptionForUser(client.record.id, client.admin);
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
      error: 'We could not safely update your subscription, so your Taiga connection is still active. Please try again.',
    }, 502);
  }
}

export async function PATCH(request) {
  const csrfRejected = requireTrustedOrigin(request);
  if (csrfRejected) return csrfRejected;

  const rateLimited = authRateLimit(request, 'taiga-connection-update', { limit: 5, windowMs: 15 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  const client = await getAuthenticatedClient();
  if (!client) return authJson(request, { error: 'Please log in.' }, 401);

  try {
    const body = await request.json();
    const requestedPhone = typeof body.phone === 'string' ? body.phone.trim().replace(/^\+/, '') : '';
    const requestedTaigaUsername = typeof body.taigaUsername === 'string' ? body.taigaUsername.trim() : '';
    const requestedTaigaPassword = typeof body.taigaPassword === 'string' ? body.taigaPassword : '';
    const currentTaskPilotPassword = typeof body.currentTaskPilotPassword === 'string' ? body.currentTaskPilotPassword : '';

    if (requestedPhone && !/^\d{7,20}$/.test(requestedPhone)) {
      return authJson(request, { error: 'Enter a valid WhatsApp number with country code.' }, 400);
    }
    if (requestedTaigaUsername.length > 254 || requestedTaigaPassword.length > 1024) {
      return authJson(request, { error: 'One of the provided fields is too long.' }, 400);
    }
    if (!requestedPhone && !requestedTaigaUsername && !requestedTaigaPassword) {
      return authJson(request, { error: 'Enter at least one new Taiga detail to update.' }, 400);
    }
    if (!(await verifyCurrentPassword(client.record, currentTaskPilotPassword))) {
      return authJson(request, { error: 'Your current TaskPilot password is not correct.' }, 400);
    }

    const current = await getCredentialsForUser(client.record.id, client.admin);
    if (!current) return authJson(request, { error: 'No Taiga connection exists for this account.' }, 404);

    const phone = requestedPhone || current.whatsapp_number;
    const taigaUsername = requestedTaigaUsername || current.taiga_username;
    const taigaPassword = requestedTaigaPassword || decrypt(current.taiga_password_enc);

    try {
      await axios.post(`${TAIGA_API_BASE_URL}/auth`, {
        type: 'normal',
        username: taigaUsername,
        password: taigaPassword,
      });
    } catch (error) {
      if ([400, 401, 403].includes(error?.response?.status)) {
        return authJson(request, { error: 'Could not connect to Taiga. Check the new username and password.' }, 400);
      }
      return authJson(request, { error: 'Taiga is temporarily unavailable. Please try again shortly.' }, 503);
    }

    await updateCredentialsForUser(phone, client.record.id, {
      whatsapp_number: phone,
      display_name: client.record.name,
      taiga_username: taigaUsername,
      taiga_password_enc: encrypt(taigaPassword),
      taiga_base_url: TAIGA_API_BASE_URL,
      user: client.record.id,
    }, client.admin);

    if (current.whatsapp_number !== phone) {
      await deleteSession(current.whatsapp_number, client.admin);
    }
    await saveSession(phone, 'idle', {
      tasks: [],
      taskIndex: 0,
      currentTask: null,
      welcomeShown: false,
    });

    return authJson(request, { success: true });
  } catch (error) {
    console.error('Taiga connection update failed.', { code: error?.code, status: error?.status, message: error?.message });
    if (error?.code === 'WHATSAPP_ALREADY_CONNECTED') return authJson(request, { error: error.message }, 409);
    if (error?.message?.includes('ENCRYPTION_MASTER_KEY')) {
      return authJson(request, { error: 'Secure credential storage is not ready. Please contact TaskPilot support.' }, 503);
    }
    return authJson(request, { error: 'We could not update your Taiga connection. Please try again.' }, 503);
  }
}
