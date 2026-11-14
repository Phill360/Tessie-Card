import test from 'node:test';
import assert from 'node:assert/strict';
import { numeric, quantity, tariffRate, estimateCosts, scheduleTimestamp, numberLimits, validateConfig } from '../src/tessie-card.js';
const e = (state, unit) => ({ state, attributes: { unit_of_measurement: unit } });
test('unavailable and malformed measurements never become zero', () => {
  for (const value of [undefined, null, '', ' ', 'unknown', 'unavailable', 'NaN', 'Infinity', true]) assert.equal(numeric(e(value)), null);
  assert.equal(numeric(e('0')), 0);
  assert.equal(quantity(e('7200', 'W'), 'power'), 7.2);
  assert.equal(quantity(e('7200', 'bananas'), 'power'), null);
  assert.equal(quantity(e('12400', 'Wh'), 'energy'), 12.4);
  assert.equal(quantity(e('1.75', 'h'), 'minutes'), 105);
});
test('tariffs require explicit units, handle cents and preserve negative prices', () => {
  assert.equal(tariffRate(e('30', 'c/kWh'), 'AUD'), .3);
  assert.equal(tariffRate(e('.30', 'AUD/kWh'), 'AUD'), .3);
  assert.equal(tariffRate(e('-.1', 'AUD/kWh'), 'AUD'), -.1);
  assert.equal(tariffRate(e('.3', 'USD/kWh'), 'AUD'), null);
  assert.equal(tariffRate(e('.3', undefined), 'AUD'), null);
});
test('session cost overrides current-rate estimate; additional estimate includes configured losses', () => {
  const base = { tariff: .3, energy: 12.4, sessionCost: null, remainingEnergy: null, battery: 62, limit: 80, capacity: 60, efficiency: .9 };
  const result = estimateCosts(base);
  assert.ok(Math.abs(result.session - 3.72) < 1e-10);
  assert.ok(Math.abs(result.remaining - 3.6) < 1e-10);
  assert.equal(result.estimatedSession, true);
  assert.equal(estimateCosts({ ...base, sessionCost: 4.2 }).session, 4.2);
  assert.equal(estimateCosts({ ...base, sessionCost: 4.2 }).estimatedSession, false);
  assert.equal(estimateCosts({ ...base, tariff: null }).remaining, null);
  assert.equal(estimateCosts({ ...base, capacity: undefined }).remaining, null);
  assert.equal(estimateCosts({ ...base, remainingEnergy: 10 }).remaining, 3);
  assert.equal(estimateCosts({ ...base, battery: 90 }).remaining, 0);
  assert.equal(estimateCosts({ ...base, energy: null }).session, null);
});
test('one-off start uses Home Assistant timezone, rejects past dates and DST ambiguity', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(scheduleTimestamp('2026-11-15T08:00', 'Australia/Sydney', now), Date.parse('2026-11-14T21:00:00Z') / 1000);
  assert.throws(() => scheduleTimestamp('2025-01-01T08:00', 'Australia/Sydney', now), /future/);
  assert.throws(() => scheduleTimestamp('2026-10-04T02:30', 'Australia/Sydney', now), /daylight/);
  assert.throws(() => scheduleTimestamp('2026-04-05T02:30', 'Australia/Sydney', now), /daylight/);
  assert.throws(() => scheduleTimestamp('2026-02-30T08:00', 'UTC', now));
  assert.throws(() => scheduleTimestamp('', 'UTC', now));
});
test('number controls require real entity capabilities', () => {
  assert.equal(numberLimits(e('32')), null);
  assert.deepEqual(numberLimits({ state: '32', attributes: { min: 5, max: 32, step: 1 } }), { min: 5, max: 32, step: 1 });
});
test('configuration rejects incorrect entity domains, unknown mappings and unsafe asset URLs', () => {
  const config = { entities: { battery: 'sensor.battery', charge: 'switch.charge', charge_limit: 'number.limit', charge_current: 'number.current' } };
  assert.deepEqual(validateConfig(config), config);
  assert.throws(() => validateConfig({ entities: {} }), /Missing/);
  assert.throws(() => validateConfig({ entities: { ...config.entities, charge: 'button.charge' } }), /switch/);
  assert.throws(() => validateConfig({ ...config, vehicle_image: 'javascript:alert(1)' }), /URL/);
  assert.throws(() => validateConfig({ ...config, schedule: {} }), /control_script/);
  assert.throws(() => validateConfig({ ...config, charging_efficiency: 0 }), /efficiency/);
});
