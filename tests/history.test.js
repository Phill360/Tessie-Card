import test from 'node:test';
import assert from 'node:assert/strict';
import { batteryHistory, batteryHistoryPath, distanceHistory, TessieCard, validateConfig } from '../src/tessie-card.js';

test('optional sections require boolean settings and a hidden graph does not request history', () => {
  assert.equal(validateConfig({ show_battery_graph: false, show_schedule: false }).show_schedule, false);
  for (const key of ['show_battery_graph', 'show_schedule']) assert.throws(() => validateConfig({ [key]: 'false' }), /true or false/);
  const card = new TessieCard();
  card._config = { show_battery_graph: false };
  card._historyRequest = {};
  card._ensureHistory();
  assert.equal(card._historyRequest, null);
});

const start = Date.parse('2026-11-22T00:00:00Z'), end = start + 86400000;
const state = (hour, value) => ({ last_changed: new Date(start + hour * 3600000).toISOString(), state: String(value) });
const odometer = (hour, value, unit) => ({ ...state(hour, value), ...(unit ? { attributes: { unit_of_measurement: unit } } : {}) });

test('distance uses the rolling-window baseline, converts units and keeps parked periods flat', () => {
  const result = distanceHistory([odometer(-2, 990, 'km'), odometer(-1, 1000, 'km'), odometer(6, 1000), odometer(12, 1064.2), odometer(23, 1064.2), odometer(25, 1200)], start, end);
  assert.ok(Math.abs(result.total - 64.2) < 1e-9);
  assert.equal(result.partial, false);
  assert.deepEqual(result.points.map(p => Math.round(p.value * 10) / 10), [0, 0, 64.2, 64.2]);
  assert.ok(Math.abs(distanceHistory([odometer(0, 100, 'mi'), odometer(20, 110)], start, end).total - 16.09344) < 1e-9);
  assert.equal(distanceHistory([odometer(0, 1000, 'm'), odometer(20, 2000)], start, end).total, 1);
});

test('distance distinguishes missing data from zero and rejects resets and unknown units', () => {
  assert.equal(distanceHistory([], start, end).total, null);
  assert.equal(distanceHistory([odometer(0, 100, 'km')], start, end).total, 0);
  assert.equal(distanceHistory([odometer(0, 100, 'unknown')], start, end).total, null);
  const partial = distanceHistory([odometer(6, 100, 'km'), odometer(12, 110)], start, end);
  assert.equal(partial.total, 10); assert.equal(partial.partial, true);
  const reset = distanceHistory([odometer(0, 100, 'km'), odometer(12, 10)], start, end);
  assert.equal(reset.total, null); assert.equal(reset.reset, true); assert.deepEqual(reset.points, []);
  const gap = distanceHistory([odometer(0, 100, 'km'), odometer(6, 'unavailable'), odometer(12, 110)], start, end);
  assert.equal(gap.total, 10); assert.equal(gap.points[1].value, null);
  assert.match(batteryHistoryPath(gap.points, start, end, 20), /M210.00,100.00 H380$/);
});

test('odometer failures do not hide battery history and mapping changes invalidate the distance cache', async () => {
  const card = new TessieCard(), requests = [];
  Object.defineProperty(card, 'isConnected', { value: true }); card._render = () => {};
  card._config = { entities: { battery: 'sensor.battery', odometer: 'sensor.odometer' } };
  card._hass = { connection: {}, callApi: async (method, path) => {
    requests.push(path);
    if (path.includes('filter_entity_id=sensor.odometer')) throw new Error('not recorded');
    return [[state(0, 80)]];
  } };
  card._ensureHistory(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(card._historyStates[0].state, '80'); assert.equal(card._historyError, '');
  assert.match(card._distanceError, /unavailable/); assert.equal(requests.length, 2);
  assert.match(requests[0], /no_attributes/);
  assert.doesNotMatch(requests[1], /no_attributes/);
  card._distanceStates = [odometer(0, 123, 'km')];
  card._config.entities.odometer = 'sensor.other_odometer'; card._ensureHistory();
  assert.deepEqual(card._distanceStates, []);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 4);
});

test('history includes the initial state, clips the window and retains unavailable gaps', () => {
  const points = batteryHistory([state(-2, 80), state(-1, 75), state(12, 'unavailable'), state(13, 60), state(25, 90)], start, end);
  assert.deepEqual(points, [{ time: start, value: 75 }, { time: start + 43200000, value: null }, { time: start + 46800000, value: 60 }]);
  const path = batteryHistoryPath(points, start, end);
  assert.equal(path, 'M40.00,65.00 H210.00 M224.17,86.00 H380');
});

test('history rejects malformed timestamps and out of range percentages', () => {
  assert.deepEqual(batteryHistory([{ state: '42' }, state(1, 101), state(2, -1), state(3, '')], start, end).map(p => p.value), [null, null, null]);
  assert.equal(batteryHistoryPath([], start, end), '');
  assert.equal(batteryHistoryPath(batteryHistory([state(12, 50)], start, end), start, end), 'M210.00,100.00 H380');
});

test('history requests only the selected battery, throttles refreshes and ignores an old vehicle response', async () => {
  const card = new TessieCard(), requests = [], pending = [];
  Object.defineProperty(card, 'isConnected', { value: true });
  card._render = () => {};
  card._hass = { connection: {}, callApi: (method, path) => { requests.push({ method, path }); return new Promise(resolve => pending.push(resolve)); } };
  card._config = { entities: { battery: 'sensor.first_battery' } };
  card._ensureHistory(); card._ensureHistory();
  await Promise.resolve();
  assert.equal(requests.length, 1);
  assert.match(requests[0].path, /filter_entity_id=sensor.first_battery/);
  assert.equal(requests[0].method, 'GET');
  card._config.entities.battery = 'sensor.second_battery'; card._ensureHistory();
  await Promise.resolve();
  pending[1]([[state(1, 40)]]);
  await new Promise(resolve => setImmediate(resolve));
  pending[0]([[state(1, 80)]]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(card._historyStates[0].state, '40');
  card._ensureHistory(); assert.equal(requests.length, 2);
  card._historyFetched = 0;
  card._hass.callApi = async () => { throw new Error('history disabled'); };
  card._ensureHistory();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(card._historyError, /history unavailable/);
});
