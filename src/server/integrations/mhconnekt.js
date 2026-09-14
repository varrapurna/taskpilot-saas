import axios from 'axios';
import { decrypt, encrypt } from '@/server/security/crypto';
import { saveMhConnection } from '@/server/database/mhconnekt';

const API_BASE_URL = 'https://hrmproductionmachine.mhconnekt.com/api';

function providerError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.providerStatus = status;
  return error;
}

function expiryFromJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return Number.isFinite(payload.exp) ? new Date(payload.exp * 1000).toISOString() : null;
  } catch { return null; }
}

async function login(email, password) {
  try {
    const { data } = await axios.post(`${API_BASE_URL}/login/`, { email, password }, { timeout: 15000 });
    if (!data?.access || !data?.refresh) throw providerError('MH Connekt returned an incomplete login response.', 'MH_INVALID_LOGIN_RESPONSE');
    return data;
  } catch (error) {
    if (error?.code?.startsWith('MH_')) throw error;
    if ([400, 401, 403].includes(error?.response?.status)) throw providerError('Could not sign in to MH Connekt. Check your email and password.', 'MH_LOGIN_REJECTED', error.response.status);
    throw providerError('MH Connekt is temporarily unavailable.', 'MH_UNAVAILABLE', error?.response?.status);
  }
}

async function refresh(refreshToken) {
  try {
    const { data } = await axios.post(`${API_BASE_URL}/refresh/`, { refresh: refreshToken }, { timeout: 15000 });
    if (!data?.access || !data?.refresh) throw providerError('MH Connekt returned an incomplete refresh response.', 'MH_INVALID_REFRESH_RESPONSE');
    return data;
  } catch (error) {
    if (error?.code?.startsWith('MH_')) throw error;
    if ([400, 401, 403].includes(error?.response?.status)) throw providerError('Your MH Connekt connection has expired. Reconnect it in TaskPilot.', 'MH_RECONNECT_REQUIRED', error.response.status);
    throw providerError('MH Connekt is temporarily unavailable.', 'MH_UNAVAILABLE', error?.response?.status);
  }
}

export async function connectMhConnekt({ userId, phone, email, password, pb }) {
  const tokens = await login(email, password);
  // Password intentionally falls out of scope here and is never persisted.
  return saveMhConnection(userId, phone, {
    whatsapp_number: phone,
    mh_email: email,
    access_token_enc: encrypt(tokens.access),
    refresh_token_enc: encrypt(tokens.refresh),
    access_expires_at: expiryFromJwt(tokens.access),
  }, pb);
}

export async function updateMhConnektConnection({ connection, phone, email, password, pb }) {
  const nextPhone = phone || connection.whatsapp_number;
  const nextEmail = email || connection.mh_email;
  if (nextEmail !== connection.mh_email && !password) {
    throw providerError('Enter the MH Connekt password when changing its email.', 'MH_PASSWORD_REQUIRED');
  }

  const tokens = password ? await login(nextEmail, password) : null;
  return saveMhConnection(connection.user, nextPhone, {
    whatsapp_number: nextPhone,
    mh_email: nextEmail,
    access_token_enc: tokens ? encrypt(tokens.access) : connection.access_token_enc,
    refresh_token_enc: tokens ? encrypt(tokens.refresh) : connection.refresh_token_enc,
    access_expires_at: tokens ? expiryFromJwt(tokens.access) : connection.access_expires_at,
  }, pb);
}

export async function getMhAccessToken(connection, pb) {
  const expiresAt = new Date(connection.access_expires_at || 0).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) return decrypt(connection.access_token_enc);
  const tokens = await refresh(decrypt(connection.refresh_token_enc));
  await saveMhConnection(connection.user, connection.whatsapp_number, {
    whatsapp_number: connection.whatsapp_number,
    mh_email: connection.mh_email,
    access_token_enc: encrypt(tokens.access),
    refresh_token_enc: encrypt(tokens.refresh),
    access_expires_at: expiryFromJwt(tokens.access),
  }, pb);
  return tokens.access;
}

export function createMhConnektClient(accessToken) {
  const client = axios.create({ baseURL: API_BASE_URL, timeout: 15000, headers: { Authorization: `Bearer ${accessToken}` } });
  return {
    async getProjects() { return (await client.get('/Project_Management/Employee_Project_View/')).data?.results || []; },
    async getTasks(projectId) {
      const { data } = await client.get(`/Project_Management/Employee_View_Tasks/${encodeURIComponent(projectId)}/`, { params: { 'To-do': false, exclude_completed: true, 'exclude-to-do': true, page_size: 100 } });
      return data?.results?.tasks || [];
    },
    async getWorkingHours(startDate, endDate) { return (await client.get('/Project_Management/FetchWorkingHours/', { params: { start_date: startDate, end_date: endDate } })).data; },
    async getWorkLocationInfo() { return (await client.get('/attendance/work-location-info/')).data; },
    async getTimesheets(startDate, endDate) { return (await client.get('/Project_Management/Timesheet_list/', { params: { start_date: startDate, end_date: endDate } })).data; },
    async createTimesheet(projectId, entries, status = 'Draft') {
      if (!['Draft', 'Submitted'].includes(status)) throw new Error('Invalid MH Connekt timesheet status.');
      if (!Array.isArray(entries) || !entries.length) throw new Error('At least one timesheet entry is required.');
      const payload = {
        Timesheet_status: status,
        date: entries[0].Date,
        time_sheet: entries.map((entry) => ({
          ...entry,
          Timesheet_status: status,
          timesheet_status: status,
          Total_Hrs: entry.hrs + (entry.min / 60),
        })),
      };
      return (await client.post(`/Project_Management/Timesheet_task_creation/${encodeURIComponent(projectId)}/`, payload)).data;
    },
  };
}
