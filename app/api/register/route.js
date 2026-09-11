import axios from 'axios';
import { encrypt } from '@/server/security/crypto';
import { saveCredentials } from '@/server/database/pocketbase';
import { getCorsHeaders } from '@/server/http/cors';

const TAIGA_API_BASE_URL = 'https://api.taiga.io/api/v1';

function validateRegistration({ name, phone, taigaUsername, taigaPassword, taigaBaseUrl }) {
  if (
    ![name, phone, taigaUsername, taigaPassword, taigaBaseUrl].every(
      (value) => typeof value === 'string' && value.trim()
    )
  ) {
    return { error: 'All fields are required.' };
  }

  const normalizedPhone = phone.trim().replace(/^\+/, '');
  if (!/^\d{7,20}$/.test(normalizedPhone)) {
    return { error: 'Enter a valid WhatsApp number with country code.' };
  }

  if (name.trim().length > 100 || taigaUsername.trim().length > 254) {
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
      name: name.trim(),
      phone: normalizedPhone,
      taigaUsername: taigaUsername.trim(),
      taigaPassword,
      taigaBaseUrl: TAIGA_API_BASE_URL,
    },
  };
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
    const registration = validateRegistration(await request.json());
    if (registration.error) {
      return Response.json({ error: registration.error }, { status: 400, ...responseOptions });
    }

    const { name, phone, taigaUsername, taigaPassword, taigaBaseUrl } = registration.data;

    try {
      await axios.post(`${taigaBaseUrl}/auth`, {
        type: 'normal',
        username: taigaUsername,
        password: taigaPassword,
      });
    } catch {
      return Response.json(
        { error: 'Could not connect to Taiga. Check your username and password.' },
        { status: 400, ...responseOptions }
      );
    }

    await saveCredentials(phone, {
      whatsapp_number: phone,
      display_name: name,
      taiga_username: taigaUsername,
      taiga_password_enc: encrypt(taigaPassword),
      taiga_base_url: taigaBaseUrl,
    });

    return Response.json({ success: true, phone }, responseOptions);
  } catch (err) {
    console.error('Register error:', err.message);
    if (err.code === 'WHATSAPP_ALREADY_CONNECTED') {
      return Response.json({ error: err.message }, { status: 409, ...responseOptions });
    }
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, ...responseOptions }
    );
  }
}
