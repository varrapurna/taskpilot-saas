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

test('Phase 1 blocks normal-user integrations while preserving admin testing access', async () => {
  const feature = await source('src/server/features/integrations.js');
  const taiga = await source('app/api/integrations/taiga/route.js');
  const mh = await source('app/api/integrations/mhconnekt/route.js');
  const register = await source('app/api/register/route.js');
  const billing = await source('app/api/billing/subscription/route.js');
  const webhook = await source('app/api/webhook/route.js');
  const dashboard = await source('app/(product)/_components/DashboardClient.js');
  const onboarding = await source('app/(product)/onboard/page.js');

  assert.match(feature, /TASKPILOT_INTEGRATIONS_ENABLED/);
  assert.match(feature, /user\?\.role === 'admin'/);
  assert.match(feature, /INTEGRATIONS_LOCKED/);
  for (const route of [taiga, mh, register, billing]) {
    assert.match(route, /canUseIntegrations/);
    assert.match(route, /integrationsLockedResponse/);
  }
  assert.match(webhook, /canUserIdUseIntegrations/);
  assert.match(webhook, /Phase 1 launch/);
  assert.match(dashboard, /Connections are coming soon/);
  assert.match(onboarding, /Connections are coming soon/);
});

test('verification links always open the public site and explain cross-device sign-in', async () => {
  const template = await source('database/pocketbase/migrations/1789700000_pin_taskpilot_verification_link.js');
  const accountPage = await source('app/(auth)/account/[mode]/page.js');
  const verificationRoute = await source('app/api/auth/verify-email/route.js');

  assert.match(template, /https:\/\/www\.taskpilotapp\.online\/account\/verify\?token=\{TOKEN\}/);
  assert.match(template, /any phone or computer/);
  assert.match(accountPage, /any phone or computer/);
  assert.match(verificationRoute, /confirmVerification\(token\)/);
});
