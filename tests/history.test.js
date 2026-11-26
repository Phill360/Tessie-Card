import test from 'node:test';
import assert from 'node:assert/strict';
import { batteryHistory, batteryHistoryPath, distanceHistory, graphWindow, TessieCard, validateConfig } from '../src/tessie-card.js';

test('graph windows default to rolling 24 hours and Today starts at midnight in the HA timezone', () => {
  const now = Date.parse('2026-11-26T01:00:00Z');
  assert.equal(graphWindow(undefined, 'Australia/Sydney', now).start, now - 86400000);
  assert.equal(graphWindow('today', 'Australia/Sydney', now).start, Date.parse('2026-11-25T13:00:00Z'));
  assert.equal(graphWindow('today', 'Australia/Adelaide', now).start, Date.parse('2026-11-25T13:30:00Z'));
  assert.equal(graphWindow('today', 'America/Los_Angeles', now).start, Date.parse('2026-11-25T08:00:00Z'));
  assert.equal(graphWindow('today', 'UTC', now).start, Date.parse('2026-11-26T00:00:00Z'));
  assert.equal(validateConfig({ graph_period: 'today' }).graph_period, 'today');
  assert.equal(validateConfig({ graph_period: '24h' }).graph_period, '24h');
  for (const period of ['week', '', false, null]) assert.throws(() => validateConfig({ graph_period: period }), /graph_period/);
});

test('Today follows 23 and 25 hour local days and handles the exact midnight boundary', () => {
  const spring = graphWindow('today', 'Australia/Sydney', Date.parse('2026-10-04T12:59:59Z'));
  assert.equal(spring.start, Date.parse('2026-10-03T14:00:00Z'));
  assert.equal(spring.end - spring.start, 23 * 3600000 - 1000);
  const autumn = graphWindow('today', 'Australia/Sydney', Date.parse('2026-04-05T13:59:59Z'));
  assert.equal(autumn.start, Date.parse('2026-04-04T13:00:00Z'));
  assert.equal(autumn.end - autumn.start, 25 * 3600000 - 1000);
  const midnight = Date.parse('2026-11-25T13:00:00Z');
  const window = graphWindow('today', 'Australia/Sydney', midnight);
  assert.equal(window.start, midnight); assert.equal(window.end, midnight);
  assert.doesNotMatch(batteryHistoryPath([{ time: midnight, value: 50 }], midnight, midnight), /NaN|Infinity/);
});

test('changing period, local date or timezone refreshes both histories and discards stale responses', async () => {
  const originalNow = Date.now;
  let now = Date.parse('2026-11-26T01:00:00Z'); Date.now = () => now;
  try {
    const card = new TessieCard(), requests = [], pending = [];
    Object.defineProperty(card, 'isConnected', { value: true }); card._render = () => {};
    card._config = { entities: { battery: 'sensor.battery', odometer: 'sensor.odometer' } };
    card._hass = { connection: {}, config: { time_zone: 'Australia/Sydney' }, callApi: async (method, path) => { requests.push(path); return new Promise(resolve => pending.push(resolve)); } };
    card._ensureHistory(); await Promise.resolve();
    card._config.graph_period = 'today'; card._ensureHistory(); await Promise.resolve();
    assert.equal(requests.length, 4);
    assert.match(requests[2], /history\/period\/2026-11-25T13:00:00.000Z/);
    pending[2]([[{ last_changed: new Date(now).toISOString(), state: '70' }]]); pending[3]([]);
    await new Promise(resolve => setImmediate(resolve));
    pending[0]([[{ last_changed: new Date(now).toISOString(), state: '90' }]]); pending[1]([]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(card._historyStates[0].state, '70');
    // Cross midnight within the five-minute cache lifetime.
    now = Date.parse('2026-11-26T12:59:00Z'); card._historyFetched = now;
    now = Date.parse('2026-11-26T13:01:00Z'); card._ensureHistory(); await Promise.resolve();
    assert.equal(requests.length, 6);
    assert.match(requests[4], /history\/period\/2026-11-26T13:00:00.000Z/);
    card._hass.config.time_zone = 'UTC'; card._ensureHistory(); await Promise.resolve();
    assert.equal(requests.length, 8);
    assert.match(requests[6], /history\/period\/2026-11-26T00:00:00.000Z/);
    for (const resolve of pending.slice(4)) resolve([]);
    await new Promise(resolve => setImmediate(resolve));
  } finally { Date.now = originalNow; }
});

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
