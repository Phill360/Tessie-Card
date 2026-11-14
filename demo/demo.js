import '../tessie-card.js';
const card = document.querySelector('tessie-card');
const entity = (state, attributes = {}) => ({ state: String(state), attributes });
const config = {
  type: 'custom:tessie-card', name: 'Model 3', subtitle: '2025 · White · Nova wheels', currency: 'AUD', battery_capacity_kwh: 60,
  entities: { battery: 'sensor.demo_battery', charge: 'switch.demo_charge', charging: 'binary_sensor.demo_charging', plugged_in: 'binary_sensor.demo_plugged', charge_limit: 'number.demo_limit', charge_current: 'number.demo_current', power: 'sensor.demo_power', completion: 'sensor.demo_completion', session_energy: 'sensor.demo_energy', tariff: 'sensor.demo_tariff' },
  schedule: { control_script: 'script.demo_schedule', datetime_entity: 'input_datetime.demo_start', armed_entity: 'input_boolean.demo_armed', status_entity: 'input_select.demo_status' }
};
let states, dark = false;
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
function reset(mode = 'charging') {
  card.setConfig(config);
  states = {
    'sensor.demo_battery': entity(mode === 'complete' ? 80 : 62, { unit_of_measurement: '%' }),
    'switch.demo_charge': entity(mode === 'charging' || mode === 'error' ? 'on' : 'off'),
    'binary_sensor.demo_charging': entity(mode === 'charging' || mode === 'error' ? 'on' : 'off'),
    'binary_sensor.demo_plugged': entity(mode === 'disconnected' ? 'off' : 'on'),
    'number.demo_limit': entity(80, { min: 50, max: 100, step: 1, unit_of_measurement: '%' }),
    'number.demo_current': entity(32, { min: 5, max: 32, step: 1, unit_of_measurement: 'A' }),
    'sensor.demo_power': entity(mode === 'charging' || mode === 'error' ? 7.2 : 0, { unit_of_measurement: 'kW' }),
    'sensor.demo_completion': entity(new Date(Date.now() + 105 * 60000).toISOString(), { device_class: 'timestamp' }),
    'sensor.demo_energy': entity(12.4, { unit_of_measurement: 'kWh' }),
    'sensor.demo_tariff': entity(.3, { unit_of_measurement: 'AUD/kWh' }),
    'script.demo_schedule': entity('off'),
    'input_datetime.demo_start': entity('2026-01-01 00:00:00', { timestamp: 0 }),
    'input_boolean.demo_armed': entity('off'), 'input_select.demo_status': entity('Idle')
  };
  if (mode === 'unavailable') for (const [key, value] of Object.entries(states)) if (!key.startsWith('input_') && !key.startsWith('script.')) value.state = 'unavailable';
  publish();
}
function publish() { card.hass = { states: { ...states }, config: { time_zone: zone }, locale: { language: 'en-AU' }, themes: { darkMode: dark }, callService }; }
async function callService(domain, service, data) {
  document.getElementById('log').textContent = `Simulated: ${domain}.${service}\n${JSON.stringify(data)}`;
  if (document.getElementById('state').value === 'error') throw new Error('Demo: vehicle rejected the command.');
  await new Promise(resolve => setTimeout(resolve, 350));
  if (domain === 'number') states[data.entity_id] = { ...states[data.entity_id], state: String(data.value) };
  if (domain === 'switch') {
    const on = service === 'turn_on';
    states['switch.demo_charge'].state = on ? 'on' : 'off';
    states['binary_sensor.demo_charging'].state = on ? 'on' : 'off';
    states['sensor.demo_power'].state = on ? '7.2' : '0';
    states['sensor.demo_completion'].state = new Date(Date.now() + 105 * 60000).toISOString();
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
window.tessieDemo = { card, config, get states() { return states; }, reset, publish };
