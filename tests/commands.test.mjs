import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, InvalidCommandError } from '../lib/command-parser.ts';
import { mapDeviceCommand } from '../smartthings/command-mapper.ts';
import { normalizeSmartThingsDevice } from '../smartthings/normalizer.ts';

const appliance = (capability) => ({ id: 'test', kind: 'appliance', capabilities: { raw: [capability] }, state: { remoteControlEnabled: true, operatingState: 'ready' } });

test('UI appliance payload is accepted and maps separately for each Samsung capability', () => {
  for (const capability of ['samsungce.washerOperatingState', 'samsungce.dishwasherOperation']) {
    assert.deepEqual(mapDeviceCommand(appliance(capability), parseCommand({ action: 'appliance.start' })),
      [{ component: 'main', capability, command: 'start' }]);
  }
});

test('invalid bodies and invalid control values fail before device lookup', () => {
  for (const value of [null, [], 'start', {}, { commands: [] }, { action: 'start' },
    { action: 'switch.set', value: true }, { action: 'ventilation.setLevel', value: 'turbo' },
    ...[NaN, Infinity, 4, 41, '24'].map(value => ({ action: 'heating.setSetpoint', value }))]) {
    assert.throws(() => parseCommand(value), InvalidCommandError);
  }
});

test('remote control, offline, running and unsupported appliance guards remain enforced', () => {
  const base = appliance('samsungce.washerOperatingState');
  for (const state of [{ remoteControlEnabled: false }, { remoteControlEnabled: undefined }, { online: false }, { operatingState: 'running' }]) {
    assert.throws(() => mapDeviceCommand({ ...base, state: { ...base.state, ...state } }, { action: 'appliance.start' }));
  }
  assert.throws(() => mapDeviceCommand(appliance('switch'), { action: 'appliance.start' }));
  assert.throws(() => mapDeviceCommand({ ...base, kind: 'doorlock' }, { action: 'appliance.start' }));
});

test('light, heating and ventilation preserve SmartThings payload shapes', () => {
  const device = { kind: 'thermostat', state: {}, capabilities: { switch: true, thermostatHeatingSetpoint: true, fanSpeed: true } };
  assert.deepEqual(mapDeviceCommand(device, parseCommand({ action: 'switch.set', value: 'off' })), [{ component: 'main', capability: 'switch', command: 'off' }]);
  assert.deepEqual(mapDeviceCommand(device, parseCommand({ action: 'heating.setSetpoint', value: 24 })), [{ component: 'main', capability: 'thermostatHeatingSetpoint', command: 'setHeatingSetpoint', arguments: [24] }]);
  assert.deepEqual(mapDeviceCommand(device, parseCommand({ action: 'ventilation.setLevel', value: 'medium' })), [{ component: 'main', capability: 'switch', command: 'on' }, { component: 'main', capability: 'fanSpeed', command: 'setFanSpeed', arguments: [2] }]);
});

test('capabilities from a different component cannot be sent to main', () => {
  const device = normalizeSmartThingsDevice({ deviceId: 'test', name: 'washer', components: [{ id: 'secondary', capabilities: [{ id: 'samsungce.washerOperatingState', version: 1 }] }] }, new Map());
  assert.equal(device.controllable, false);
  assert.equal(device.state.online, undefined);
});


test('washer and dishwasher expose power without enabling unrelated appliance switches', () => {
  for (const capability of ['samsungce.washerOperatingState', 'samsungce.dishwasherOperation']) {
    const device = normalizeSmartThingsDevice({ deviceId: 'test', name: 'appliance', components: [{ id: 'main', capabilities: [{ id: capability, version: 1 }, { id: 'switch', version: 1 }] }] }, new Map());
    assert.equal(device.capabilities.switch, true);
    assert.deepEqual(mapDeviceCommand(device, { action: 'switch.set', value: 'off' }), [{ component: 'main', capability: 'switch', command: 'off' }]);
  }
  const fridge = normalizeSmartThingsDevice({ deviceId: 'fridge', name: 'fridge', components: [{ id: 'main', capabilities: [{ id: 'switch', version: 1 }] }] }, new Map());
  assert.equal(fridge.capabilities.switch, false);
});
