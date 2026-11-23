import '../tessie-card.js';
import { demoRegistry } from './registry.js';
const card = document.querySelector('tessie-card');
const entity = (state, attributes = {}) => ({ state: String(state), attributes });
const config = {
  type: 'custom:tessie-card', name: 'Model 3', subtitle: '2025 · White · Nova wheels', currency: 'AUD', battery_capacity_kwh: 60,
  entities: { battery: 'sensor.demo_battery', odometer: 'sensor.demo_odometer', charge: 'switch.demo_charge', charging: 'binary_sensor.demo_charging', plugged_in: 'binary_sensor.demo_plugged', charge_limit: 'number.demo_limit', charge_current: 'number.demo_current', power: 'sensor.demo_power', completion: 'sensor.demo_completion', session_energy: 'sensor.demo_energy', tariff: 'sensor.demo_tariff' },
  schedule: { control_script: 'script.demo_schedule', datetime_entity: 'input_datetime.demo_start', armed_entity: 'input_boolean.demo_armed', status_entity: 'input_select.demo_status' }
};
let states, dark = false, currentConfig = config;
const registry = demoRegistry();
const registryListeners = new Map();
const connection = { subscribeEvents: async (callback, type) => { const set = registryListeners.get(type) || new Set(); set.add(callback); registryListeners.set(type, set); return () => set.delete(callback); } };
async function callWS({ type }) { if (type === 'config/device_registry/list') return structuredClone(registry.devices); if (type === 'config/entity_registry/list') return structuredClone(registry.entries); throw new Error('Unsupported demo request'); }
async function callApi(method, path) {
  if (method !== 'GET' || !path.startsWith('history/period/')) throw new Error('Unsupported demo API request');
  const now = Date.now(), second = path.includes('sensor.second_battery');
  if (path.includes('odometer')) {
    const distance = path.includes('second_odometer') ? [0,0,0,4,15,28,28,28,28] : [0,0,0,0,26,64.2,64.2,64.2,64.2];
    return [distance.map((km, i) => ({ state: String(42000 + km), attributes: { unit_of_measurement: 'km' }, last_changed: new Date(now - 86400000 + i * 10800000).toISOString() }))];
  }
  const levels = second ? [72,72,70,65,59,52,45,45,45] : [78,78,76,70,54,36,36,48,62];
  return [levels.map((state, i) => ({ state: String(state), last_changed: new Date(now - 86400000 + i * 10800000).toISOString() }))];
}
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
function reset(mode = 'charging') {
  card.setConfig(currentConfig);
  states = {
    'sensor.demo_battery': entity(mode === 'complete' ? 80 : 62, { unit_of_measurement: '%' }),
    'sensor.demo_odometer': entity(42064.2, { unit_of_measurement: 'km' }),
    'switch.demo_charge': entity(mode === 'charging' || mode === 'error' ? 'on' : 'off'),
    'binary_sensor.demo_charging': entity(mode === 'charging' || mode === 'error' ? 'on' : 'off'),
    'binary_sensor.demo_plugged': entity(mode === 'disconnected' ? 'off' : 'on'),
    'number.demo_limit': entity(80, { min: 50, max: 100, step: 1, unit_of_measurement: '%' }),
    'number.demo_current': entity(32, { min: 5, max: 32, step: 1, unit_of_measurement: 'A' }),
    'sensor.demo_power': entity(mode === 'charging' || mode === 'error' ? 7.2 : 0, { unit_of_measurement: 'kW' }),
    'sensor.demo_completion': entity(new Date(Date.now() + 105 * 60000).toISOString(), { device_class: 'timestamp' }),
    'sensor.demo_charging_status': entity(mode === 'charging' || mode === 'error' ? 'charging' : mode === 'disconnected' ? 'disconnected' : 'stopped'),
    'sensor.demo_energy': entity(12.4, { unit_of_measurement: 'kWh' }),
    'sensor.demo_tariff': entity(.3, { unit_of_measurement: 'AUD/kWh' }),
    'script.demo_schedule': entity('off'),
    'input_datetime.demo_start': entity('2026-01-01 00:00:00', { timestamp: 0 }),
    'input_boolean.demo_armed': entity('off'), 'input_select.demo_status': entity('Idle')
  };
  for (const [id, value] of Object.entries(states)) if (id.includes('.demo_')) states[id.replace('.demo_', '.second_')] = structuredClone(value);
  states['sensor.second_battery'].state = '45';
  if (mode === 'unavailable') for (const [key, value] of Object.entries(states)) if (!key.startsWith('input_') && !key.startsWith('script.')) value.state = 'unavailable';
  publish();
}
function publish() { const hass = { states: { ...states }, connection, callWS, callApi, config: { time_zone: zone }, locale: { language: 'en-AU' }, themes: { darkMode: dark }, callService }; document.querySelectorAll('tessie-card,tessie-card-editor').forEach(element => { element.hass = hass; }); }
async function callService(domain, service, data) {
  document.getElementById('log').textContent = `Simulated: ${domain}.${service}\n${JSON.stringify(data)}`;
  if (document.getElementById('state').value === 'error') throw new Error('Demo: vehicle rejected the command.');
  await new Promise(resolve => setTimeout(resolve, 350));
  if (domain === 'number') states[data.entity_id] = { ...states[data.entity_id], state: String(data.value) };
  if (domain === 'switch') {
    const on = service === 'turn_on';
    const prefix = data.entity_id.includes('.second_') ? 'second' : 'demo';
    states[`switch.${prefix}_charge`].state = on ? 'on' : 'off';
    states[`binary_sensor.${prefix}_charging`].state = on ? 'on' : 'off';
    states[`sensor.${prefix}_charging_status`].state = on ? 'charging' : 'stopped';
    states[`sensor.${prefix}_power`].state = on ? '7.2' : '0';
    states[`sensor.${prefix}_completion`].state = new Date(Date.now() + 105 * 60000).toISOString();
  }
  if (domain === 'script') {
    states['input_boolean.demo_armed'].state = data.command === 'schedule' ? 'on' : 'off';
    states['input_select.demo_status'].state = data.command === 'schedule' ? 'Scheduled' : 'Cancelled';
    if (data.timestamp) {
      states['input_datetime.demo_start'] = entity(new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(data.timestamp * 1000), { timestamp: data.timestamp });
    }
  }
  publish();
}
document.getElementById('state').onchange = e => reset(e.target.value);
document.getElementById('theme').onclick = () => { dark = !dark; document.body.classList.toggle('dark', dark); document.getElementById('theme').textContent = dark ? 'Light theme' : 'Dark theme'; publish(); };
card.addEventListener('hass-more-info', e => { document.getElementById('log').textContent = `Entity details: ${e.detail.entityId}`; });
card.setConfig(config); reset();
const appearanceEditor = document.getElementById('appearance-editor');
appearanceEditor.setConfig(config);
appearanceEditor.addEventListener('config-changed', event => {
  currentConfig=event.detail.config; card.setConfig(currentConfig); publish();
});
publish();
window.tessieDemo = { card, config, registry, connection, callWS, get states() { return states; }, reset, publish, registryEvent: type => registryListeners.get(type)?.forEach(callback => callback({ event_type: type })) };
