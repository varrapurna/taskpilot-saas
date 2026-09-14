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

  assert.match(form, /method: 'DELETE'/);
  assert.match(form, />Update details</);
  assert.match(form, />Disconnect</);
});

test('an unavailable MH collection cannot break the main dashboard', async () => {
  const dashboard = await source('app/api/dashboard/route.js');

  assert.match(dashboard, /let mhConnection = null/);
  assert.match(dashboard, /MH Connekt status is temporarily unavailable on the dashboard/);
  assert.match(dashboard, /mhConnektConnected: Boolean\(mhConnection\)/);
});
