import axios from 'axios';
import { encrypt } from '@/server/security/crypto';
import { saveCredentials, saveSession } from '@/server/database/pocketbase';
import { getCorsHeaders } from '@/server/http/cors';
import { getAuthenticatedClient } from '@/server/auth/account';
import { getBillingSubscription } from '@/server/billing/subscriptions';

const TAIGA_API_BASE_URL = 'https://api.taiga.io/api/v1';

function validateRegistration({ phone, taigaUsername, taigaPassword, taigaBaseUrl }) {
  if (
    ![phone, taigaUsername, taigaPassword, taigaBaseUrl].every(
      (value) => typeof value === 'string' && value.trim()
    )
  ) {
    return { error: 'All fields are required.' };
  }

  const normalizedPhone = phone.trim().replace(/^\+/, '');
  if (!/^\d{7,20}$/.test(normalizedPhone)) {
    return { error: 'Enter a valid WhatsApp number with country code.' };
  }

  if (taigaUsername.trim().length > 254) {
    return { error: 'One of the provided fields is too long.' };
  }

  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(taigaBaseUrl.trim());
  } catch {
    return { error: 'Enter a valid Taiga URL.' };
  }

  // A user-supplied API URL could otherwise make the server call internal AWS
  // services. Support the official Taiga Cloud endpoint for this release.
  if (parsedBaseUrl.toString().replace(/\/$/, '') !== TAIGA_API_BASE_URL) {
    return { error: 'Only the official Taiga Cloud URL is supported right now.' };
  }

  return {
    data: {
      phone: normalizedPhone,
      taigaUsername: taigaUsername.trim(),
      taigaPassword,
      taigaBaseUrl: TAIGA_API_BASE_URL,
    },
  };
}

function registrationErrorResponse(error, responseOptions) {
  const message = error instanceof Error ? error.message : '';
  console.error('Taiga registration failed.', {
    name: error?.name,
    code: error?.code,
    status: error?.status,
    message,
  });

  if (error?.code === 'WHATSAPP_ALREADY_CONNECTED') {
    return Response.json({ error: message }, { status: 409, ...responseOptions });
  }
  if (message.includes('ENCRYPTION_MASTER_KEY')) {
    return Response.json(
      { error: 'Secure credential storage is not ready. Please contact TaskPilot support.' },
      { status: 503, ...responseOptions }
    );
  }
  if (error?.code === 'TAIGA_UNAVAILABLE') {
    return Response.json(
      { error: 'Taiga is temporarily unavailable. Please try again shortly.' },
      { status: 503, ...responseOptions }
    );
  }
  if (message.includes('POCKETBASE_URL') || error?.status >= 500) {
    return Response.json(
      { error: 'The connection service is temporarily unavailable. Please try again shortly.' },
      { status: 503, ...responseOptions }
    );
  }
  return Response.json(
    { error: 'We could not save your Taiga connection. Please try again.' },
    { status: 500, ...responseOptions }
  );
}

export function OPTIONS(request) {
  const corsHeaders = getCorsHeaders(request);
  return new Response(null, { status: corsHeaders ? 204 : 403, headers: corsHeaders || {} });
}

export async function POST(request) {
  const corsHeaders = getCorsHeaders(request);
  if (request.headers.get('origin') && !corsHeaders) {
    return Response.json({ error: 'This website is not allowed to connect.' }, { status: 403 });
  }

  const responseOptions = {
    headers: { ...(corsHeaders || {}), 'Cache-Control': 'no-store' },
  };

  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return Response.json({ error: 'Please sign in before connecting Taiga.' }, { status: 401, ...responseOptions });
    }

    const billing = await getBillingSubscription(client.record.id, client.admin);
    if (!billing?.razorpay_autopay_accepted) {
      return Response.json({ error: 'Set up and approve your ₹100/month auto-pay before connecting Taiga.' }, { status: 402, ...responseOptions });
    }

    const registration = validateRegistration(await request.json());
    if (registration.error) {
      return Response.json({ error: registration.error }, { status: 400, ...responseOptions });
    }

    const { phone, taigaUsername, taigaPassword, taigaBaseUrl } = registration.data;

    try {
      await axios.post(`${taigaBaseUrl}/auth`, {
        type: 'normal',
        username: taigaUsername,
        password: taigaPassword,
      });
    } catch (error) {
      if ([400, 401, 403].includes(error?.response?.status)) {
        return Response.json(
          { error: 'Could not connect to Taiga. Check your username and password.' },
          { status: 400, ...responseOptions }
        );
      }
      const unavailableError = new Error('Taiga is temporarily unavailable.');
      unavailableError.code = 'TAIGA_UNAVAILABLE';
      throw unavailableError;
    }

    await saveCredentials(phone, client.record.id, {
      whatsapp_number: phone,
      display_name: client.record.name,
      taiga_username: taigaUsername,
      taiga_password_enc: encrypt(taigaPassword),
      taiga_base_url: taigaBaseUrl,
      user: client.record.id,
    });

    // No outbound WhatsApp message is sent here. The customer starts the
    // conversation by sending "hi", then the webhook replies in that window.
    await saveSession(phone, 'idle', {
      tasks: [],
      taskIndex: 0,
      currentTask: null,
      welcomeShown: false,
    });

    return Response.json({ success: true, phone }, responseOptions);
  } catch (error) {
    return registrationErrorResponse(error, responseOptions);
  }
}
