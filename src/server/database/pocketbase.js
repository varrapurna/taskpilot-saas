import PocketBase from 'pocketbase';

function validateWhatsAppNumber(whatsappNumber) {
  if (!/^\d{7,20}$/.test(whatsappNumber || '')) {
    throw new Error('Invalid WhatsApp number.');
  }
}

export async function createAdminClient() {
  if (!process.env.POCKETBASE_URL) {
    throw new Error('POCKETBASE_URL is not configured.');
  }

  const pb = new PocketBase(process.env.POCKETBASE_URL);
  await pb.collection('_superusers').authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL,
    process.env.POCKETBASE_ADMIN_PASSWORD
  );
  return pb;
}

function phoneFilter(whatsappNumber) {
  validateWhatsAppNumber(whatsappNumber);
  return `whatsapp_number="${whatsappNumber}"`;
}

async function findSession(pb, whatsappNumber) {
  try {
    return await pb.collection('sessions').getFirstListItem(phoneFilter(whatsappNumber));
  } catch {
    return null;
  }
}

export async function getCredentialsByPhone(whatsappNumber) {
  const pb = await createAdminClient();
  return pb.collection('credentials').getFirstListItem(phoneFilter(whatsappNumber));
}

export async function getIntegrationStatusForUser(userId) {
  const pb = await createAdminClient();
  try {
    await pb.collection('credentials').getFirstListItem(`user = "${userId}"`);
    return { taigaConnected: true };
  } catch {
    return { taigaConnected: false };
  }
}

export async function getSession(whatsappNumber) {
  const pb = await createAdminClient();
  return findSession(pb, whatsappNumber);
}

export async function saveSession(whatsappNumber, step, data) {
  const pb = await createAdminClient();
  const existing = await findSession(pb, whatsappNumber);
  const payload = { whatsapp_number: whatsappNumber, step, data };
  if (existing) {
    return pb.collection('sessions').update(existing.id, payload);
  }
  return pb.collection('sessions').create(payload);
}

export async function saveCredentials(phone, userId, payload) {
  validateWhatsAppNumber(phone);
  const pb = await createAdminClient();
  let existing = null;
  try {
    existing = await pb.collection('credentials').getFirstListItem(phoneFilter(phone));
  } catch (_) {}
  if (existing && existing.user !== userId) {
    const error = new Error('This WhatsApp number is already connected.');
    error.code = 'WHATSAPP_ALREADY_CONNECTED';
    throw error;
  }

  if (existing) {
    return pb.collection('credentials').update(existing.id, payload);
  }
  return pb.collection('credentials').create(payload);
}
