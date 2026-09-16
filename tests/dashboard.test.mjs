import test from 'node:test';
import assert from 'node:assert/strict';
import { bulkTargets, parseFavorites, summarizeCommands } from '../lib/dashboard.ts';

test('whole-home controls include only available lights, outlets and heating', () => {
  const device = (kind, state = {}) => ({ id: kind, kind, controllable: true, capabilities: { switch: true }, state });
  const devices = ['light', 'thermostat', 'outlet', 'appliance', 'doorlock', 'ventilation'].map(kind => device(kind));
  devices.push(device('light', { online: false }), device('light', { statusError: 'unavailable' }));
  assert.deepEqual(bulkTargets(devices, 'home').map(d => d.id), ['light', 'thermostat', 'outlet']);
  assert.equal(bulkTargets(devices, 'light').length, 1);
});

test('accepted commands are pending, not confirmed successes', () => {
  assert.deepEqual(summarizeCommands([
    { status: 'fulfilled', value: { ok: true, outcome: 'confirmed' } },
    { status: 'fulfilled', value: { ok: true, outcome: 'unconfirmed' } },
    { status: 'fulfilled', value: { ok: true } },
    { status: 'fulfilled', value: { ok: false } },
    { status: 'rejected', reason: new Error('offline') },
  ]), { confirmed: 1, pending: 2, failed: 2 });
});

test('favorites tolerate missing, malformed and unexpected stored values', () => {
  for (const value of [null, '{', 'null', '{}', '123']) assert.deepEqual(parseFavorites(value), []);
  assert.deepEqual(parseFavorites('["washer",null,12,"washer","light"]'), ['washer', 'light']);
});
