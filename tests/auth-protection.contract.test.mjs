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

test('all signed-in users can use integrations without a launch-only feature lock', async () => {
  const taiga = await source('app/api/integrations/taiga/route.js');
  const mh = await source('app/api/integrations/mhconnekt/route.js');
  const register = await source('app/api/register/route.js');
  const billing = await source('app/api/billing/subscription/route.js');
  const webhook = await source('app/api/webhook/route.js');
  const dashboard = await source('app/(product)/_components/DashboardClient.js');
  const onboarding = await source('app/(product)/onboard/page.js');
  const taigaForm = await source('app/(product)/onboard/taiga/_components/TaigaOnboardForm.js');
  const mhForm = await source('app/(product)/onboard/mhconnekt/MhConnektOnboardForm.js');

  for (const route of [taiga, mh, register, billing]) {
    assert.doesNotMatch(route, /canUseIntegrations|integrationsLockedResponse/);
  }
  assert.doesNotMatch(webhook, /canUserIdUseIntegrations|Phase 1 launch/);
  assert.match(dashboard, /Integrations/);
  assert.match(onboarding, /Choose the tools you use/);
  for (const form of [taigaForm, mhForm]) {
    assert.doesNotMatch(form, /Connection setup is temporarily locked|Phase 1 testing|integrationsAvailable/);
  }
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

test('admin billing records Razorpay history without exposing private provider data', async () => {
  const migration = await source('database/pocketbase/migrations/1789800000_add_billing_history_fields.js');
  const webhook = await source('src/server/billing/razorpay-webhook.js');
  const subscriptions = await source('src/server/billing/subscriptions.js');
  const overview = await source('src/server/admin/overview.js');
  const syncRoute = await source('app/api/admin/billing/sync/route.js');
  const dashboard = await source('app/(product)/_components/AdminDashboard.js');
  const nginx = await source('scripts/configure-nginx.sh');

  assert.match(migration, /billing_webhook_events/);
  assert.match(migration, /payment_id/);
  assert.match(migration, /cancelled_at/);
  assert.match(webhook, /eventDetails/);
  assert.match(subscriptions, /syncRazorpayBillingHistory/);
  assert.match(subscriptions, /\/invoices\?subscription_id=/);
  assert.doesNotMatch(subscriptions, /billing_subscriptions'\)\.getFullList\(\{ sort:/);
  assert.match(syncRoute, /client\.record\.role !== 'admin'/);
  assert.match(overview, /totalCollected/);
  assert.doesNotMatch(overview, /billing_subscriptions'\)\.getFullList\(\{ sort:/);
  assert.doesNotMatch(overview, /billing_webhook_events'\)\.getFullList\(\{ sort:/);
  assert.match(dashboard, /Sync Razorpay history/);
  assert.match(dashboard, /Payment history/);
  assert.match(dashboard, /payment\.userId === selectedHistoryUser/);
  assert.match(dashboard, /historyPage/);
  assert.match(dashboard, /Back to users/);
  assert.doesNotMatch(dashboard, /historyBackdrop/);
  assert.doesNotMatch(dashboard, /scrollIntoView/);
  assert.match(nginx, /location \^~ \/api\/admin\//);
});

test('disconnect keeps a paid period but stops only the next renewal for the final workspace', async () => {
  const subscriptions = await source('src/server/billing/subscriptions.js');
  const taiga = await source('app/api/integrations/taiga/route.js');
  const mh = await source('app/api/integrations/mhconnekt/route.js');
  const billingPanel = await source('app/(product)/_components/BillingPanel.js');
  const taigaOnboarding = await source('app/(product)/onboard/taiga/_components/TaigaOnboardForm.js');
  const mhOnboarding = await source('app/(product)/onboard/mhconnekt/MhConnektOnboardForm.js');

  assert.match(subscriptions, /cancel_at_cycle_end: Boolean\(keepPaidAccess\)/);
  assert.match(subscriptions, /providerSubscription\.status === 'active'/);
  assert.match(taiga, /getMhConnectionForUser/);
  assert.match(mh, /getCredentialsForUser/);
  assert.match(taiga, /if \(!mhConnection\) await cancelRazorpaySubscriptionForUser/);
  assert.match(mh, /if \(!taigaCredentials\) await cancelRazorpaySubscriptionForUser/);
  assert.match(billingPanel, /Future auto-pay is stopped/);
  assert.match(taigaOnboarding, /Reconnect this workspace now at no extra cost/);
  assert.match(mhOnboarding, /Reconnect this workspace now at no extra cost/);
});
