import PocketBase from 'pocketbase';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/pocketbase';

export const AUTH_COOKIE = 'taskpilot_auth';

function getPocketBaseUrl() {
  if (!process.env.POCKETBASE_URL) {
    throw new Error('POCKETBASE_URL is not configured.');
  }
  return process.env.POCKETBASE_URL;
}

export function createPublicClient() {
  return new PocketBase(getPocketBaseUrl());
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

export async function createClientAccount({ name, email, password }) {
  const pb = await createAdminClient();
  const internalUsername = `client_${crypto.randomUUID().replace(/-/g, '')}`;
  const record = await pb.collection('users').create({
    name,
    email,
    username: internalUsername,
    password,
    passwordConfirm: password,
    emailVisibility: false,
  });

  await pb.collection('users').requestVerification(email);
  return record;
}

export async function requestVerification(email) {
  const pb = createPublicClient();
  await pb.collection('users').requestVerification(email);
}

export async function getAuthenticatedClient() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const pb = createPublicClient();
  pb.authStore.save(token, null);

  try {
    const auth = await pb.collection('users').authRefresh();
    if (!auth.record.verified) return null;
    return { record: auth.record, token: auth.token };
  } catch {
    return null;
  }
}

export function setAuthCookie(response, token) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function clearAuthCookie(response) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
