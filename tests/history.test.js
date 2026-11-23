import test from 'node:test';
import assert from 'node:assert/strict';
import { batteryHistory, batteryHistoryPath, TessieCard, validateConfig } from '../src/tessie-card.js';

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
