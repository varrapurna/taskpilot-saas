import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('users with both integrations receive a workspace picker', async () => {
  const webhook = await source('app/api/webhook/route.js');

  assert.match(webhook, /if \(mhConnection\)/);
  assert.match(webhook, /session\.step === 'choose_workspace'/);
  assert.match(webhook, /id: 'workspace_taiga'/);
  assert.match(webhook, /id: 'workspace_mh'/);
  assert.match(webhook, /session\.activeWorkspace === 'mh'/);
});

test('MH week summary asks for Monday through Sunday', async () => {
  const flow = await source('src/server/whatsapp/mhconnekt-flow.js');

  assert.match(flow, /function startOfWeek\(\)/);
  assert.match(flow, /const daysSinceMonday = \(date\.getUTCDay\(\) \+ 6\) % 7/);
  assert.match(flow, /getTimesheets\(startOfWeek\(\), endOfWeek\(\)\)/);
});

test('MH timesheets use MH work mode and the observed task filters', async () => {
  const flow = await source('src/server/whatsapp/mhconnekt-flow.js');
  const client = await source('src/server/integrations/mhconnekt.js');

  assert.match(flow, /await mh\.getWorkLocationInfo\(\)/);
  assert.match(flow, /work_mode: workMode/);
  assert.doesNotMatch(flow, /work_mode: 'Office'/);
  assert.match(client, /'exclude-to-do': true/);
  assert.match(client, /async getWorkLocationInfo\(\)/);
});

test('connected users can manage their MH Connekt connection', async () => {
  const form = await source('app/(product)/onboard/mhconnekt/MhConnektOnboardForm.js');
  const route = await source('app/api/integrations/mhconnekt/route.js');
  const mhManage = await source('app/(product)/manage/mhconnekt/MhConnektManageClient.js');
  const mhUpdate = await source('app/(product)/manage/mhconnekt/update/MhConnektUpdateClient.js');
  const dashboard = await source('app/(product)/_components/DashboardClient.js');

  assert.match(form, /method: 'DELETE'/);
  assert.match(form, />Update details</);
  assert.match(form, />Disconnect</);
  assert.match(form, /manage\/mhconnekt\/update/);
  assert.match(route, /verifyCurrentPassword/);
  assert.match(route, /Your current TaskPilot password is not correct/);
  assert.match(mhManage, /taiga-manage\.module\.css/);
  assert.match(mhManage, /Update MH Connekt details/);
  assert.match(mhManage, /manage\/mhconnekt\/update/);
  assert.match(mhUpdate, /Back to MH Connekt settings/);
  assert.match(mhUpdate, /Current TaskPilot password/);
  assert.match(mhUpdate, /method: 'PATCH'/);
  assert.match(route, /export async function PATCH/);
  assert.match(dashboard, /'\/manage\/mhconnekt'/);
});

test('an unavailable MH collection cannot break the main dashboard', async () => {
  const dashboard = await source('app/api/dashboard/route.js');

  assert.match(dashboard, /let mhConnection = null/);
  assert.match(dashboard, /MH Connekt status is temporarily unavailable on the dashboard/);
  assert.match(dashboard, /mhConnektConnected: Boolean\(mhConnection\)/);
});

test('MH setup reports storage readiness clearly and production deploys the main branch', async () => {
  const route = await source('app/api/integrations/mhconnekt/route.js');
  const deployScript = await source('scripts/deploy-aws.sh');
  const repairMigration = await source('database/pocketbase/migrations/1789500001_repair_mhconnekt_collections.js');
  const fieldRepairMigration = await source('database/pocketbase/migrations/1789500002_repair_mhconnekt_collection_fields.js');

  assert.match(route, /MH_STORAGE_NOT_READY/);
  assert.match(route, /MH_SECURE_STORAGE_NOT_READY/);
  assert.match(deployScript, /BRANCH="main"/);
  assert.match(repairMigration, /mhconnekt_connections/);
  assert.match(repairMigration, /mhconnekt_sessions/);
  assert.match(fieldRepairMigration, /fields\.getByName\(field\.name\)/);
  assert.match(fieldRepairMigration, /access_token_enc/);
  assert.match(fieldRepairMigration, /mhconnekt_sessions/);
});
