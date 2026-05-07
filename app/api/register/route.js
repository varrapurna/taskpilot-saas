import axios from 'axios';
import { encrypt } from '@/lib/crypto';
import { saveCredentials } from '@/lib/pocketbase';

export async function POST(request) {
  try {
    const { name, phone, taigaUsername, taigaPassword, taigaBaseUrl } = await request.json();

    if (!name || !phone || !taigaUsername || !taigaPassword || !taigaBaseUrl) {
      return Response.json({ error: 'All fields are required.' }, { status: 400 });
    }

    try {
      await axios.post(`${taigaBaseUrl}/auth`, {
        type: 'normal',
        username: taigaUsername,
        password: taigaPassword,
      });
    } catch {
      return Response.json(
        { error: 'Could not connect to Taiga. Check your username and password.' },
        { status: 400 }
      );
    }

    await saveCredentials(phone, {
      whatsapp_number: phone,
      display_name: name,
      taiga_username: taigaUsername,
      taiga_password_enc: encrypt(taigaPassword),
      taiga_base_url: taigaBaseUrl,
    });

    return Response.json({ success: true, phone });
  } catch (err) {
    console.error('Register error:', err.message);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
