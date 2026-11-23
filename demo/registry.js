// Synthetic registry data only. No real VINs or account details.
export function demoRegistry() {
  const keys = [
    ['sensor.demo_battery', 'charge_state_usable_battery_level'],
    ['switch.demo_charge', 'charge_state_charge_enable_request'],
    ['number.demo_limit', 'charge_state_charge_limit_soc'],
    ['number.demo_current', 'charge_state_charge_current_request'],
    ['binary_sensor.demo_charging', 'charge_state_charging_state'],
    ['sensor.demo_charging_status', 'charge_state_charging_state'],
    ['binary_sensor.demo_plugged', 'charge_state_conn_charge_cable'],
    ['sensor.demo_power', 'charge_state_charger_power'],
    ['sensor.demo_completion', 'charge_state_minutes_to_full_charge'],
    ['sensor.demo_energy', 'charge_state_charge_energy_added'],
    ['sensor.demo_odometer', 'vehicle_state_odometer'],
  ];
  const devices = [{ id: 'demo-vehicle-one', name: 'Model 3', model: 'Model 3' }, { id: 'demo-vehicle-two', name: 'Second vehicle', model: 'Model Y' }, { id: 'demo-energy', name: 'Powerwall', model: 'Powerwall' }];
  const entries = devices.slice(0, 2).flatMap((device, index) => keys.map(([id, key]) => ({
    entity_id: index ? id.replace('demo_', 'second_') : id,
    platform: 'tessie', device_id: device.id, translation_key: key,
    unique_id: `DEMO${index}-${key}`, disabled_by: id === 'binary_sensor.demo_charging' ? 'integration' : null,
  })));
  entries.push({ entity_id: 'sensor.powerwall_charge', platform: 'tessie', device_id: 'demo-energy', translation_key: 'percentage_charged', unique_id: 'ENERGY-percentage_charged' });
  return { devices, entries };
}
