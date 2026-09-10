import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Real Next.js routes against a local SmartThings fixture. No real credentials or devices.
const sent = [];
let allowStart = true;
let failCommand = false;
let resultStatus = "ACCEPTED";
let operatingState = "ready";
const fixtures = [
  ['washer', 'samsungce.washerOperatingState'],
  ['dishwasher', 'samsungce.dishwasherOperation'],
  ['light', 'switch'],
];
const api = createServer(async (req, res) => {
  assert.equal(req.headers.authorization, 'Bearer integration-test-token');
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/devices') return res.end(JSON.stringify({ items: fixtures.map(([id, capability]) => ({ deviceId: id, name: id, health: { state: 'ONLINE' }, components: [{ id: 'main', capabilities: [{ id: capability, version: 1 }] }] })) }));
  if (url.pathname.startsWith('/capabilities/')) return res.end(JSON.stringify({ commands: allowStart ? { start: { arguments: [] } } : {} }));
  if (url.pathname.endsWith('/status')) {
    const id = url.pathname.split('/')[2];
    const capability = fixtures.find(([name]) => name === id)[1];
    return res.end(JSON.stringify({ components: { main: { remoteControlStatus: { remoteControlEnabled: { value: true } }, [capability]: { operatingState: { value: operatingState }, switch: { value: 'on' } } } } }));
  }
  if (url.pathname.endsWith('/commands')) {
    let body = ''; for await (const chunk of req) body += chunk;
    sent.push(JSON.parse(body));
    if (failCommand) { res.statusCode = 422; return res.end('{"error":"fixture rejected"}'); }
    return res.end(JSON.stringify({ results: [{ status: resultStatus }] }));
  }
  res.statusCode = 404; res.end('{}');
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3011'], {
  env: { ...process.env, IOT_MODE: 'smartthings', SMARTTHINGS_TOKEN: 'integration-test-token', SMARTTHINGS_BASE_URL: `http://127.0.0.1:${api.address().port}`, SMARTTHINGS_LOCATION_ID: '' },
  stdio: 'ignore',
});
const base = 'http://127.0.0.1:3011';
const post = (id, body) => fetch(`${base}/api/devices/${id}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await delay(200);
  }
  assert.ok(ready, 'Next server starts');
  const devices = await (await fetch(`${base}/api/devices`)).json();
  assert.equal(devices.devices.find(d => d.id === 'light').state.switch, 'on', 'non-appliance live status loaded');
  for (const [id, capability] of fixtures.slice(0, 2)) {
    const response = await post(id, { action: 'appliance.start' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).outcome, 'unconfirmed');
    assert.deepEqual(sent.at(-1), { commands: [{ component: 'main', capability, command: 'start' }] });
  }
  assert.equal((await post('washer', { action: 'start' })).status, 400);
  assert.equal(sent.length, 2);
  allowStart = false;
  assert.equal((await post('washer', { action: 'appliance.start' })).status, 400);
  assert.equal(sent.length, 2, 'invalid capability never sends command');
  allowStart = true; failCommand = true;
  const failure = await post('dishwasher', { action: 'appliance.start' });
  assert.equal(failure.status, 502);
  assert.equal((await failure.json()).code, 'SMARTTHINGS_API_ERROR');
  failCommand = false; resultStatus = 'FAILED';
  assert.equal((await post('dishwasher', { action: 'appliance.start' })).status, 502, 'HTTP 200 with FAILED result is rejected');
  resultStatus = 'ACCEPTED';
  const power = await post('light', { action: 'switch.set', value: 'on' });
  assert.equal((await power.json()).outcome, 'confirmed');
  console.log('PASS: real Next API → local SmartThings fixture: washer, dishwasher, live light status, malformed payload, changed definition, upstream rejection.');
} finally {
  app.kill();
  api.closeAllConnections();
  await new Promise(resolve => api.close(resolve));
}
