import { createAdminClient } from '@/server/database/pocketbase';

function phoneFilter(phone) {
  if (!/^\d{7,20}$/.test(phone || '')) throw new Error('Invalid WhatsApp number.');
  return `whatsapp_number="${phone}"`;
}

export async function getMhConnectionForUser(userId, pb = null) {
  const client = pb || await createAdminClient();
  try { return await client.collection('mhconnekt_connections').getFirstListItem(`user = "${userId}"`); }
  catch (error) { if (error?.status === 404) return null; throw error; }
}

export async function getMhConnectionByPhone(phone, pb = null) {
  const client = pb || await createAdminClient();
  try { return await client.collection('mhconnekt_connections').getFirstListItem(phoneFilter(phone)); }
  catch (error) { if (error?.status === 404) return null; throw error; }
}

export async function saveMhConnection(userId, phone, payload, pb = null) {
  const client = pb || await createAdminClient();
  const existing = await getMhConnectionForUser(userId, client);
  const phoneOwner = await getMhConnectionByPhone(phone, client);
  if (phoneOwner && phoneOwner.user !== userId) {
    const error = new Error('This WhatsApp number is already connected to MH Connekt.');
    error.code = 'WHATSAPP_ALREADY_CONNECTED';
    throw error;
  }
  return existing
    ? client.collection('mhconnekt_connections').update(existing.id, payload)
    : client.collection('mhconnekt_connections').create({ user: userId, whatsapp_number: phone, ...payload });
}

export async function deleteMhConnectionForUser(userId, pb = null) {
  const client = pb || await createAdminClient();
  const connection = await getMhConnectionForUser(userId, client);
  if (!connection) return false;
  await client.collection('mhconnekt_connections').delete(connection.id);
  try {
    const session = await client.collection('mhconnekt_sessions').getFirstListItem(phoneFilter(connection.whatsapp_number));
    await client.collection('mhconnekt_sessions').delete(session.id);
  } catch (error) { if (error?.status !== 404) throw error; }
  return true;
}

export async function saveMhSession(phone, step, data, pb = null) {
  const client = pb || await createAdminClient();
  let existing = null;
  try { existing = await client.collection('mhconnekt_sessions').getFirstListItem(phoneFilter(phone)); } catch (_) {}
  const payload = { whatsapp_number: phone, step, data };
  return existing ? client.collection('mhconnekt_sessions').update(existing.id, payload) : client.collection('mhconnekt_sessions').create(payload);
}

export async function getMhSession(phone, pb = null) {
  const client = pb || await createAdminClient();
  try { return await client.collection('mhconnekt_sessions').getFirstListItem(phoneFilter(phone)); }
  catch (error) { if (error?.status === 404) return null; throw error; }
}
