import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL);

async function adminAuth() {
  if (!pb.authStore.isValid) {
    await pb.admins.authWithPassword(
      process.env.POCKETBASE_ADMIN_EMAIL,
      process.env.POCKETBASE_ADMIN_PASSWORD
    );
  }
}

export async function getCredentialsByPhone(whatsappNumber) {
  await adminAuth();
  return pb.collection('credentials').getFirstListItem(`whatsapp_number="${whatsappNumber}"`);
}

export async function getSession(whatsappNumber) {
  await adminAuth();
  try {
    return await pb.collection('sessions').getFirstListItem(`whatsapp_number="${whatsappNumber}"`);
  } catch {
    return null;
  }
}

export async function saveSession(whatsappNumber, step, data) {
  await adminAuth();
  const existing = await getSession(whatsappNumber);
  const payload = { whatsapp_number: whatsappNumber, step, data };
  if (existing) {
    return pb.collection('sessions').update(existing.id, payload);
  }
  return pb.collection('sessions').create(payload);
}

export async function saveCredentials(phone, payload) {
  await adminAuth();
  let existing = null;
  try {
    existing = await pb.collection('credentials').getFirstListItem(`whatsapp_number="${phone}"`);
  } catch (_) {}
  if (existing) {
    return pb.collection('credentials').update(existing.id, payload);
  }
  return pb.collection('credentials').create(payload);
}
