import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('account rate limits protect both shared networks and individual emails', async () => {
  const rateLimit = await source('src/server/http/rate-limit.js');
  const signup = await source('app/api/auth/signup/route.js');
  const login = await source('app/api/auth/login/route.js');
  const forgotPassword = await source('app/api/auth/forgot-password/route.js');

  assert.match(rateLimit, /key: providedKey/);
  assert.match(rateLimit, /providedKey\.trim\(\)/);
  assert.match(signup, /auth-signup-network.*limit: 25/);
  assert.match(signup, /auth-signup-email.*limit: 3[\s\S]*key: cleanEmail/);
  assert.match(login, /auth-login-network.*limit: 50/);
  assert.match(login, /auth-login-email.*limit: 10[\s\S]*key: email/);
  assert.match(forgotPassword, /auth-password-reset-network.*limit: 30/);
  assert.match(forgotPassword, /auth-password-reset-email.*limit: 3[\s\S]*key: cleanEmail/);
});

test('password reset emails have a unique branded production repair migration', async () => {
  const template = await source('database/pocketbase/migrations/1789600000_restore_taskpilot_password_reset_email_template.js');
  const forgotPassword = await source('app/api/auth/forgot-password/route.js');

  assert.match(template, /users\.resetPasswordTemplate/);
  assert.match(template, /Reset your TaskPilot password/);
  assert.match(template, /\{APP_URL\}\/account\/reset\?token=\{TOKEN\}/);
  assert.match(forgotPassword, /Password reset email request failed/);
});
