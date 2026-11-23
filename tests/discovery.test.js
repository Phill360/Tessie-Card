import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverVehicles, loadVehicles, resolveVehicleConfig, chargingState, validateConfig } from '../src/tessie-card.js';
import { demoRegistry } from '../demo/registry.js';
test('discovery isolates Tessie vehicles and maps exact metadata even after entity renaming', () => {
  const { devices, entries } = demoRegistry();
  entries[0].entity_id = 'sensor.renamed_battery';
  const vehicles = discoverVehicles(devices, entries);
  assert.equal(vehicles.length, 2); // Powerwall excluded.
  assert.equal(vehicles[0].entities.battery, 'sensor.renamed_battery');
  assert.equal(vehicles[1].entities.battery, 'sensor.second_battery');
  assert.equal(vehicles[0].entities.charge, 'switch.demo_charge');
  assert.equal(vehicles[0].entities.odometer, 'sensor.demo_odometer');
  assert.equal(vehicles[1].entities.odometer, 'sensor.second_odometer');
  assert.equal(vehicles[0].entities.charging, undefined); // Disabled binary sensor is not enabled.
  assert.equal(vehicles[0].entities.charging_status, 'sensor.demo_charging_status');
  assert.ok(vehicles[0].disabled.includes('charging'));
  assert.deepEqual(vehicles[0].missing, []);
});
test('unique IDs provide a fallback; foreign integrations, duplicate and disabled controls are not guessed', () => {
  const { devices, entries } = demoRegistry();
  for (const entry of entries) delete entry.translation_key;
  entries.push({ ...entries[2], entity_id: 'number.duplicate_limit' });
  entries.find(entry => entry.entity_id === 'number.demo_current').disabled_by = 'user';
  entries.push({ ...entries[2], platform: 'tesla_fleet', entity_id: 'number.foreign_limit' });
  const vehicle = discoverVehicles(devices, entries)[0];
  assert.equal(vehicle.entities.charge, 'switch.demo_charge');
  assert.equal(vehicle.entities.charge_limit, undefined);
  assert.equal(vehicle.entities.charge_current, undefined);
  assert.ok(vehicle.ambiguous.includes('charge_limit'));
  assert.ok(vehicle.missing.includes('charge_current'));
});
test('explicit device selection, one-vehicle auto detection, manual overrides and deleted vehicles', () => {
  const { devices, entries } = demoRegistry();
  const vehicles = discoverVehicles(devices, entries);
  const auto = validateConfig({ type: 'custom:tessie-card' });
  assert.equal(resolveVehicleConfig(auto, vehicles).detectedVehicle, null);
  assert.equal(resolveVehicleConfig(auto, vehicles.slice(0, 1)).entities.battery, 'sensor.demo_battery');
  assert.equal(resolveVehicleConfig({ ...auto, device_id: vehicles[1].id }, vehicles).entities.charge, 'switch.second_charge');
  assert.equal(resolveVehicleConfig({ ...auto, device_id: 'deleted' }, vehicles).detectedVehicle, undefined);
  const override = resolveVehicleConfig({ ...auto, device_id: vehicles[0].id, entities: { battery: 'sensor.custom', tariff: 'sensor.rate' } }, vehicles);
  assert.equal(override.entities.battery, 'sensor.custom');
  assert.equal(override.entities.tariff, 'sensor.rate');
  const manual = { entities: { battery: 'sensor.manual', charge: 'switch.manual', charge_limit: 'number.manual_limit', charge_current: 'number.manual_current' } };
  assert.equal(resolveVehicleConfig(manual, vehicles.slice(0, 1)).entities.power, undefined);
});
test('registry reads are shared per connection and recover after failures', async () => {
  const registry = demoRegistry(); let calls = 0;
  const connection = {};
  const hass = { connection, callWS: async ({ type }) => { calls++; return type.includes('device_registry') ? registry.devices : registry.entries; } };
  await Promise.all([loadVehicles(hass), loadVehicles(hass)]);
  assert.equal(calls, 2);
  await loadVehicles({ ...hass }); assert.equal(calls, 2);
  await loadVehicles(hass, true); assert.equal(calls, 4);
  const failing = { connection: {}, callWS: async () => { throw new Error('Denied'); } };
  await assert.rejects(loadVehicles(failing), /Denied/);
  failing.callWS = hass.callWS;
  assert.equal((await loadVehicles(failing)).length, 2);
});
test('actual charging status handles Tessie enum without assuming switch on means charging', () => {
  assert.equal(chargingState(undefined, { state: 'charging' }), 'on');
  assert.equal(chargingState(undefined, { state: 'starting' }), 'off');
  assert.equal(chargingState({ state: 'unavailable' }, { state: 'complete' }), 'off');
  assert.equal(chargingState({ state: 'off' }, { state: 'charging' }), 'off');
  assert.equal(chargingState(undefined, { state: 'unavailable' }), null);
});
