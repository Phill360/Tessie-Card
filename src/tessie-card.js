/* Tessie Card 0.2.3 — dependency-free Home Assistant dashboard card. */
import { ARTWORK_IMAGES, ARTWORK_FIELDS, DEFAULT_ARTWORK, selectArtwork, artworkOptions, changeArtwork } from './vehicle-artwork.js';
export const VERSION = "0.2.3";
const invalid = new Set(["unknown", "unavailable", "", "none"]);
export function numeric(entity) {
  if (!entity || entity.state == null || typeof entity.state === "boolean" || invalid.has(String(entity.state).trim().toLowerCase())) return null;
  const value = Number(entity.state);
  return Number.isFinite(value) ? value : null;
}
export function quantity(entity, kind) {
  const value = numeric(entity);
  const unit = entity?.attributes?.unit_of_measurement;
  const factors = { power: { W: .001, kW: 1, MW: 1000 }, energy: { Wh: .001, kWh: 1, MWh: 1000 }, minutes: { s: 1 / 60, min: 1, h: 60 } };
  return value !== null && Object.hasOwn(factors[kind] || {}, unit) ? value * factors[kind][unit] : null;
}
export function tariffRate(entity, currency = "AUD") {
  const value = numeric(entity);
  const unit = String(entity?.attributes?.unit_of_measurement || "").replace(/\s/g, "");
  if (value === null) return null;
  if (unit === `${currency}/kWh`) return value;
  if (["c/kWh", "¢/kWh", `${currency}c/kWh`].includes(unit)) return value / 100;
  return null;
}
export function estimateCosts({ tariff, energy, sessionCost, remainingEnergy, battery, limit, capacity, efficiency = .9 }) {
  const validEfficiency = Number.isFinite(efficiency) && efficiency > 0 && efficiency <= 1;
  const needed = remainingEnergy !== null && remainingEnergy >= 0 ? remainingEnergy :
    validEfficiency && capacity > 0 && battery !== null && limit !== null
      ? Math.max(0, limit - battery) / 100 * capacity / efficiency : null;
  return {
    session: sessionCost !== null ? sessionCost : tariff !== null && energy !== null && energy >= 0 ? tariff * energy : null,
    estimatedSession: sessionCost === null,
    remaining: tariff !== null && needed !== null ? tariff * needed : null,
  };
}
export function localDateTime(epoch, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(epoch);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// Round-trip against HA's timezone, independent of the browser timezone. Reject DST gaps and overlaps.
export function scheduleTimestamp(value, timeZone, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a start date and time.");
  const base = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(base)) throw new Error("Invalid date and time.");
  const candidates = [];
  for (let minutes = -840; minutes <= 840; minutes += 15) {
    const instant = base + minutes * 60000;
    if (localDateTime(instant, timeZone) === value) candidates.push(instant);
  }
  if (candidates.length !== 1) throw new Error("This time is missing or ambiguous due to daylight saving. Choose another time.");
  if (candidates[0] <= now + 60000) throw new Error("Choose a time more than one minute in the future.");
  return candidates[0] / 1000;
}
export function numberLimits(entity) {
  const a = entity?.attributes || {};
  const { min, max, step } = a;
  return [min, max, step].every(Number.isFinite) && max > min && step > 0 && numeric(entity) !== null
    ? { min, max, step } : null;
}
const domains = { battery: "sensor", charge_limit: "number", charge_current: "number", charge: "switch", charging: "binary_sensor", charging_status: "sensor", plugged_in: "binary_sensor", power: "sensor", completion: "sensor", time_remaining: "sensor", tariff: "sensor", session_energy: "sensor", session_cost: "sensor", remaining_energy: "sensor", location: "device_tracker" };
const requiredMappings = ["battery", "charge", "charge_limit", "charge_current"];
const tessieKeys = {
  battery: ["charge_state_usable_battery_level", "charge_state_battery_level"],
  charge: ["charge_state_charge_enable_request", "charge_state_charging_state"],
  charge_limit: ["charge_state_charge_limit_soc"],
  charge_current: ["charge_state_charge_current_request"],
  charging: ["charge_state_charging_state"],
  charging_status: ["charge_state_charging_state"],
  plugged_in: ["charge_state_conn_charge_cable"],
  power: ["charge_state_charger_power"],
  completion: ["charge_state_minutes_to_full_charge"],
  session_energy: ["charge_state_charge_energy_added"],
  location: ["location"],
};
const matchesKey = (entry, key) => entry.translation_key === key || String(entry.unique_id || "").endsWith(`-${key}`);
// Registry metadata survives renamed/localised entity IDs. Never mix platforms or devices.
export function discoverVehicles(devices, entries) {
  return devices.filter(device => !device.disabled_by).map(device => {
    const owned = entries.filter(entry => entry.platform === "tessie" && entry.device_id === device.id);
    const isVehicle = owned.some(entry => entry.entity_id?.startsWith("sensor.") && matchesKey(entry, "charge_state_usable_battery_level")) || owned.some(entry => entry.entity_id?.startsWith("switch.") && matchesKey(entry, "charge_state_charge_enable_request"));
    if (!isVehicle) return null;
    const entities = {}, disabled = [], ambiguous = [];
    for (const [mapping, keys] of Object.entries(tessieKeys)) {
      for (const key of keys) {
        const matches = owned.filter(entry => entry.entity_id?.startsWith(`${domains[mapping]}.`) && matchesKey(entry, key));
        const enabled = matches.filter(entry => !entry.disabled_by);
        if (enabled.length > 1) { ambiguous.push(mapping); break; }
        if (enabled.length === 1) { entities[mapping] = enabled[0].entity_id; break; }
        if (matches.length) disabled.push(mapping);
      }
    }
    return { id: device.id, name: device.name_by_user || device.name || device.model || "Tesla vehicle", model: device.model || "", entities, disabled, ambiguous, missing: requiredMappings.filter(key => !entities[key]) };
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
const discoveryCache = new WeakMap();
export async function loadVehicles(hass, refresh = false) {
  const connection = hass.connection || hass;
  if (!hass.callWS) throw new Error("Vehicle detection is unavailable. Configure entity mappings manually.");
  if (refresh) discoveryCache.delete(connection);
  let result = discoveryCache.get(connection);
  if (!result) {
    result = Promise.all([hass.callWS({ type: "config/device_registry/list" }), hass.callWS({ type: "config/entity_registry/list" })])
      .then(([devices, entities]) => discoverVehicles(devices, entities));
    discoveryCache.set(connection, result);
    result.catch(() => { if (discoveryCache.get(connection) === result) discoveryCache.delete(connection); });
  }
  return result;
}
export function resolveVehicleConfig(config, vehicles) {
  const manual = requiredMappings.every(key => config.entities?.[key]);
  const vehicle = config.device_id ? vehicles.find(v => v.id === config.device_id) : !manual && vehicles.length === 1 ? vehicles[0] : null;
  const entities = { ...(vehicle?.entities || {}), ...config.entities };
  return { ...config, entities, name: config.name || vehicle?.name, detectedVehicle: vehicle, missing: requiredMappings.filter(key => !entities[key]) };
}
export function chargingState(binary, status) {
  if (["on", "off"].includes(binary?.state)) return binary.state;
  const value = status?.state;
  return value === "charging" ? "on" : ["starting", "stopped", "complete", "disconnected", "no_power"].includes(value) ? "off" : null;
}
export function validateConfig(config) {
  if (!config || typeof config !== "object") throw new Error("Invalid card configuration.");
  if (config.entities !== undefined && (!config.entities || typeof config.entities !== "object" || Array.isArray(config.entities))) throw new Error("entities must be a mapping.");
  if (config.device_id !== undefined && (typeof config.device_id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(config.device_id))) throw new Error("device_id must be a Home Assistant device ID.");
  for (const [key, id] of Object.entries(config.entities || {})) {
    if (!domains[key]) throw new Error(`Unknown entity mapping: ${key}`);
    if (typeof id !== "string" || !new RegExp(`^${domains[key]}\\.[a-z0-9_]+$`).test(id)) throw new Error(`entities.${key} must be a ${domains[key]} entity ID.`);
  }
  if (config.currency && !/^[A-Z]{3}$/.test(config.currency)) throw new Error("currency must be a three-letter code, e.g. AUD.");
  if (config.battery_capacity_kwh !== undefined && !(Number.isFinite(config.battery_capacity_kwh) && config.battery_capacity_kwh > 0)) throw new Error("battery_capacity_kwh must be positive.");
  if (config.charging_efficiency !== undefined && !(Number.isFinite(config.charging_efficiency) && config.charging_efficiency > 0 && config.charging_efficiency <= 1)) throw new Error("charging_efficiency must be between 0 and 1.");
  if (config.vehicle_image) {
    if (typeof config.vehicle_image !== "string" || !/^(https?:\/\/|\/(?!\/))/.test(config.vehicle_image)) throw new Error("vehicle_image must be an http(s) or local absolute URL.");
  }
  if (config.artwork !== undefined && (!config.artwork || typeof config.artwork !== "object" || Array.isArray(config.artwork) || Object.keys(config.artwork).some(key => !ARTWORK_FIELDS.includes(key)) || !selectArtwork(config.artwork))) throw new Error("artwork must select an available model, generation, trim, paint, interior and wheel combination.");
  if (config.schedule) {
    for (const [key, domain] of Object.entries({ control_script: "script", datetime_entity: "input_datetime", armed_entity: "input_boolean", status_entity: "input_select" })) {
      if (!new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(config.schedule[key] || "")) throw new Error(`schedule.${key} must be a ${domain} entity ID.`);
    }
  }
  return structuredClone({ ...config, entities: config.entities || {} });
}
const css = `
:host{display:block;--tc-green:#20b940;--tc-bg:var(--ha-card-background,var(--card-background-color,#fff));--tc-text:var(--primary-text-color,#20252b);--tc-muted:var(--secondary-text-color,#67717b);--tc-line:var(--divider-color,#dce0e5);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif);color:var(--tc-text)}
*{box-sizing:border-box}ha-card{display:block;background:var(--tc-bg);border-radius:var(--ha-card-border-radius,20px);overflow:hidden;border:1px solid var(--tc-line);color:var(--tc-text)}
.head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px 0}.name{font-size:24px;font-weight:650;letter-spacing:-.6px}.sub,.note{color:var(--tc-muted);font-size:13px}.sub{margin-top:4px}.badge{border-radius:20px;padding:7px 12px;background:color-mix(in srgb,var(--tc-muted) 12%,transparent);font-size:13px;font-weight:600;white-space:nowrap}.active .badge{color:var(--tc-green);background:color-mix(in srgb,var(--tc-green) 13%,transparent)}
.scene{position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 90%,color-mix(in srgb,var(--tc-muted) 8%,transparent),transparent 65%)}.scene img{display:block}.scene .power{position:absolute;right:24px;top:16px;text-align:right;text-shadow:0 0 8px var(--tc-bg);font-size:13px;color:var(--tc-muted)}.power strong{display:block;font-size:21px;color:var(--tc-green);margin-top:3px}.scene.idle img{filter:saturate(.35)}
.content{padding:0 22px 22px}.battery{display:flex;gap:20px;align-items:center;margin:10px 0 18px}.percent{font-size:36px;font-weight:650;letter-spacing:-1px}.battery-text{min-width:76px}.battery-track{flex:1;position:relative;padding-top:25px}.track{height:13px;border-radius:9px;background:color-mix(in srgb,var(--tc-muted) 18%,transparent);overflow:hidden}.fill{height:100%;width:0;background:var(--tc-green);border-radius:9px;transition:width .4s}.marker{position:absolute;top:18px;height:27px;border-left:2px solid var(--tc-text)}.limit-text{position:absolute;right:0;top:0;font-size:12px;color:var(--tc-muted)}
.metrics,.costs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid var(--tc-line);border-radius:13px;overflow:hidden;margin-bottom:12px}.metric{padding:13px 14px;min-width:0}.metric:nth-child(even){border-left:1px solid var(--tc-line)}.metric .label{font-size:12px;color:var(--tc-muted);display:block;margin-bottom:5px}.metric strong{font-size:20px;font-weight:600;display:block;font-variant-numeric:tabular-nums}.metric button{font:inherit;text-align:left;padding:0;border:0;background:none;color:inherit;cursor:pointer;width:100%}.costs strong{font-size:19px}.note{font-size:12px;margin:5px 0 0;line-height:1.4}.tariff{margin:-3px 0 17px}
button,input{font:inherit}button{cursor:pointer;border:1px solid var(--tc-line);color:var(--tc-text);background:color-mix(in srgb,var(--tc-muted) 8%,var(--tc-bg));border-radius:9px;padding:10px 14px;min-height:42px}button:disabled{opacity:.5;cursor:default}.primary{width:100%;background:var(--tc-green);border:0;color:#fff;font-weight:600;margin:0 0 14px}.control{margin:0 0 15px}.control label{display:flex;justify-content:space-between;font-size:14px;font-weight:550;gap:12px}.control output{font-variant-numeric:tabular-nums}input[type=range]{width:100%;accent-color:var(--tc-green);margin:12px 0 0;height:22px}input:disabled{opacity:.4}input[type=datetime-local]{width:100%;min-width:0;background:var(--tc-bg);color:var(--tc-text);border:1px solid var(--tc-line);border-radius:8px;padding:11px;margin:8px 0 10px;color-scheme:light}.dark input[type=datetime-local]{color-scheme:dark}.schedule{padding:14px;border:1px solid var(--tc-line);border-radius:13px}.schedule h3{font-size:16px;margin:0 0 5px;font-weight:600}.schedule label{font-size:12px;color:var(--tc-muted)}.schedule-actions{display:flex;gap:8px;flex-wrap:wrap}.schedule-actions button{flex:1}.feedback{font-size:13px;padding:10px 0 0;line-height:1.5}.error{color:var(--error-color,#c54242)}[hidden]{display:none!important}:focus-visible{outline:2px solid var(--tc-green);outline-offset:3px}.asset-error{padding:35px 24px;text-align:center;color:var(--tc-muted)}
@media(max-width:360px){.head{padding:18px 16px 0}.content{padding:0 14px 16px}.name{font-size:21px}.metric{padding:12px 10px}.metric strong{font-size:17px}.scene .power{right:16px;font-size:12px}.power strong{font-size:18px}.battery{gap:12px}.percent{font-size:32px}}
@media(prefers-reduced-motion:reduce){.fill{transition:none}}
/* Prepared car images and cable use the same 1000 x 625 coordinates. */
.scene{aspect-ratio:auto;padding-top:calc(62.5% + 34px)}
.vehicle-art{position:absolute;inset:34px 0 0;overflow:hidden}
.scene img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.scene.custom-image{aspect-ratio:1.92;padding-top:0}
.custom-image .vehicle-art img{inset:0;width:100%;height:100%;object-fit:contain}
.scene .power{top:4px}
.flow{position:absolute;inset:0;width:100%;height:100%;background:none;opacity:1;pointer-events:none}
.flow .cable-base,.flow .cable-pulse{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:5}
.cable-base{stroke:#69747b}
.active .cable-base{stroke:#349d7d}
.flow .cable-pulse{stroke:#8beec2;stroke-width:3;stroke-dasharray:90 910;opacity:0}
.active .cable-pulse{opacity:.9;animation:charge-flow 2.8s linear infinite}
.charge-plug{fill:#30383c;stroke:#7d898e;stroke-width:1.5}
@keyframes charge-flow{from{stroke-dashoffset:0}to{stroke-dashoffset:-1000}}
@media(prefers-reduced-motion:reduce){.active .cable-pulse{animation:none;opacity:0}}
`;
const cableSvg = `<svg id="flow" class="flow" viewBox="0 0 1000 625" aria-hidden="true" hidden><defs>
  <path id="cable-route" d="M 10 600 L 650 190" pathLength="1000"/>
  <linearGradient id="cable-fade" gradientUnits="userSpaceOnUse" x1="10" y1="600" x2="650" y2="190"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".4" stop-color="white"/></linearGradient>
  <mask id="cable-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="625"><rect width="1000" height="625" fill="url(#cable-fade)"/></mask>
  </defs><g mask="url(#cable-mask)"><use class="cable-base" href="#cable-route"/><use class="cable-pulse" href="#cable-route"/></g>
  <g id="charge-connector" class="charge-plug"><path d="M -15 2 L 0 -6 Q 6 -4 6 2 L -8 13 Z"/><path d="M -3 -7 L -11 -22 L 11 -23 L 17 -12 Z"/></g></svg>`;
export class TessieCard extends (globalThis.HTMLElement || class {}) {
  constructor() { super(); this.attachShadow?.({ mode: "open" }); this._draftSchedule = ""; this._vehicles = []; this._discoverySeq = 0; }
  setConfig(config) { this._userConfig = validateConfig(config); this._config = this._userConfig; clearTimeout(this._pendingTimer); this._pending = null; this._message = ""; this._error = false; this._discoveryError = ""; this._draftSchedule = ""; this._mounted = false; this._ensureDiscovery(); this._render(); }
  set hass(value) { this._hass = value; this._ensureDiscovery(); this._checkPending(); this._render(); }
  getCardSize() { return 14; }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }
  static getStubConfig() { return { type: "custom:tessie-card" }; }
  static getConfigElement() { return document.createElement("tessie-card-editor"); }
  connectedCallback() { this._tick = setInterval(() => this._render(), 30000); this._ensureDiscovery(); this._render(); }
  disconnectedCallback() { clearInterval(this._tick); clearTimeout(this._pendingTimer); clearTimeout(this._refreshTimer); this._pending = null; this._unwatch?.(); this._unwatch = null; this._watchConnection = null; this._discoveryConnection = null; this._discoverySeq++; this._watchGeneration = (this._watchGeneration || 0) + 1; this._refreshOnConnect = true; }
  _ensureDiscovery() {
    if (!this._hass || !this._userConfig) return;
    const needs = this._userConfig.device_id || requiredMappings.some(key => !this._userConfig.entities[key]);
    if (!needs) return;
    const connection = this._hass.connection || this._hass;
    if (this._discoveryConnection !== connection) { this._discoveryConnection = connection; this._refreshVehicles(Boolean(this._refreshOnConnect)); this._refreshOnConnect = false; }
    if (this.isConnected && this._hass.connection?.subscribeEvents && this._watchConnection !== connection) {
      this._unwatch?.(); this._watchConnection = connection;
      const generation = this._watchGeneration = (this._watchGeneration || 0) + 1;
      const refresh = () => { if (!this.isConnected || this._watchConnection !== connection) return; clearTimeout(this._refreshTimer); this._refreshTimer = setTimeout(() => this._refreshVehicles(true), 100); };
      Promise.allSettled(["entity_registry_updated", "device_registry_updated"].map(type => connection.subscribeEvents(refresh, type))).then(results => {
        const unsubscribe = () => results.filter(result => result.status === "fulfilled").forEach(result => result.value());
        if (!this.isConnected || this._watchConnection !== connection || this._watchGeneration !== generation) unsubscribe(); else this._unwatch = unsubscribe;
      });
    }
  }
  async _refreshVehicles(refresh = false) {
    const sequence = ++this._discoverySeq;
    this._discoveryLoading = true; this._discoveryError = ""; this._render();
    try { const vehicles = await loadVehicles(this._hass, refresh); if (sequence === this._discoverySeq) this._vehicles = vehicles; }
    catch { if (sequence === this._discoverySeq) { this._vehicles = []; this._discoveryError = "Could not read the Home Assistant registries. Use the editor to retry or map entities manually."; } }
    finally { if (sequence === this._discoverySeq) { this._discoveryLoading = false; this._render(); } }
  }
  _entity(key) { return this._hass?.states[this._config?.entities[key]]; }
  _el(id) { return this.shadowRoot.getElementById(id); }
  _text(id, text) { this._el(id).textContent = text; }
  _more(key) { const entityId = this._config.entities[key]; if (entityId) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } })); }
  _mount() {
    this.shadowRoot.innerHTML = `<style>${css}.setup{padding:16px 22px;background:color-mix(in srgb,var(--tc-muted) 8%,transparent)}.setup p{margin:0 0 10px;font-size:13px;line-height:1.5}</style><ha-card id="card"><div id="setup" class="setup" hidden><p id="discovery-note" role="status"></p><button id="discovery-retry">Refresh detection</button></div><header class="head"><div><div id="name" class="name"></div><div id="subtitle" class="sub"></div></div><span id="status" class="badge"></span></header>
      <div id="scene" class="scene"><div class="vehicle-art"><img id="vehicle" alt="White Model 3 Highland with Nova wheels, viewed from the left rear">${cableSvg}</div><div id="asset-error" class="asset-error" hidden>Vehicle image unavailable. Configure vehicle_image or check the bundled artwork.</div><div class="power">AC charging<strong id="hero-power"></strong></div></div>
      <div class="content"><p id="artwork-note" class="note" hidden></p><div class="battery"><div class="battery-text"><div id="battery" class="percent"></div><span class="sub">Battery</span></div><div class="battery-track"><span id="limit-label" class="limit-text"></span><div id="track" class="track" role="meter" aria-label="Battery charge" aria-valuemin="0" aria-valuemax="100"><div id="fill" class="fill"></div></div><div id="marker" class="marker" aria-hidden="true"></div></div></div>
      <div class="metrics"><div class="metric"><button id="power-info"><span class="label">Charging power</span><strong id="power"></strong></button></div><div class="metric"><button id="time-info"><span class="label">Time remaining</span><strong id="remaining"></strong></button></div><div class="metric"><button id="finish-info"><span class="label">Estimated finish</span><strong id="finish"></strong></button></div><div class="metric"><span class="label">Charge limit</span><strong id="limit-metric"></strong></div></div>
      <div class="costs"><div class="metric"><span id="session-label" class="label">Session so far</span><strong id="session-cost"></strong><p id="session-note" class="note"></p></div><div class="metric"><span class="label">To charge limit (est.)</span><strong id="remaining-cost"></strong><p id="estimate-note" class="note"></p></div></div><p id="tariff" class="note tariff"></p>
      <button id="charge" class="primary"></button>
      <div class="control"><label for="limit">Charge limit<output id="limit-value" for="limit"></output></label><input id="limit" type="range"><p id="limit-note" class="note"></p></div>
      <div class="control"><label for="current">Charging current<output id="current-value" for="current"></output></label><input id="current" type="range"><p id="current-note" class="note"></p></div>
      <section class="schedule"><h3>One-off start</h3><p id="schedule-summary" class="note"></p><label for="schedule-time" id="schedule-label">Start date and time</label><input id="schedule-time" type="datetime-local"><div class="schedule-actions"><button id="schedule-save">Schedule start</button><button id="schedule-cancel">Cancel start</button></div><p class="note">Saving a start time does not stop charging now.</p></section><div id="feedback" class="feedback" role="status" aria-live="polite"></div></div></ha-card>`;
    this._el("vehicle").addEventListener("error", () => { this._vehicleAssetFailed = true; this._el("vehicle").hidden = true; this._el("flow").toggleAttribute("hidden", true); this._el("asset-error").hidden = false; });
    this._el("discovery-retry").onclick = () => this._refreshVehicles(true);
    this._el("power-info").onclick = () => this._more("power");
    this._el("time-info").onclick = () => this._more(this._config.entities.completion ? "completion" : "time_remaining");
    this._el("finish-info").onclick = () => this._more("completion");
    this._el("charge").onclick = () => this._charge();
    for (const [id, key, suffix] of [["limit", "charge_limit", "%"], ["current", "charge_current", " A"]]) {
      this._el(id).oninput = e => this._text(`${id}-value`, `${e.target.value}${suffix}`);
      this._el(id).onchange = e => this._number(key, Number(e.target.value));
    }
    this._el("schedule-time").value = this._draftSchedule;
    this._el("schedule-time").oninput = e => { this._draftSchedule = e.target.value; };
    this._el("schedule-save").onclick = () => this._schedule("schedule");
    this._el("schedule-cancel").onclick = () => this._schedule("cancel");
    this._mounted = true;
  }
  _render() {
    if (!this._hass || !this._userConfig || !this.shadowRoot) return;
    this._config = resolveVehicleConfig(this._userConfig, this._vehicles);
    if (!this._mounted) this._mount();
    const c = this._config, h = this._hass, e = key => this._entity(key);
    const actualCharging = chargingState(e("charging"), e("charging_status"));
    const charging = actualCharging === "on"; // A charge switch being on is not proof of active charging.
    const plugged = e("plugged_in")?.state || (e("charging_status")?.state === "disconnected" ? "off" : undefined);
    const chargeValid = ["on", "off"].includes(e("charge")?.state);
    const batteryValue = numeric(e("battery"));
    const battery = batteryValue !== null && batteryValue >= 0 && batteryValue <= 100 ? batteryValue : null;
    const limit = numeric(e("charge_limit"));
    const zone = h.config?.time_zone || "UTC";
    const dark = h.themes?.darkMode ?? globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    this._el("card").className = `${charging ? "active" : ""} ${dark ? "dark" : ""}`;
    this._el("scene").classList.toggle("idle", !charging);
    this._text("name", c.name || "Tessie vehicle");
    const location = e("location")?.state && !invalid.has(e("location").state) ? e("location").state.replaceAll("_", " ") : "Tessie";
    this._text("subtitle", c.subtitle || [c.detectedVehicle?.model, location].filter(Boolean).join(" · "));
    let detectionNote = this._discoveryError || (this._discoveryLoading ? "Detecting Tessie vehicles…" : "");
    if (!detectionNote && c.missing.length) detectionNote = !c.detectedVehicle ? (this._userConfig.device_id ? "Selected Tessie vehicle was not found. Choose a vehicle in the card editor." : this._vehicles.length > 1 ? "Multiple Tessie vehicles found. Choose one in the card editor." : "No Tessie vehicle found. Configure the integration or map entities manually.") : `Missing or ambiguous entities: ${c.missing.join(", ")}. Check disabled entities or use manual overrides in YAML.`;
    this._el("setup").hidden = !detectionNote; this._text("discovery-note", detectionNote); this._el("discovery-retry").disabled = Boolean(this._discoveryLoading);
    const chargeStatus = e("charging_status")?.state;
    const status = charging ? "Charging" : plugged === "off" ? "Disconnected" : chargeStatus === "starting" ? "Starting" : chargeStatus === "no_power" ? "No power" : actualCharging === "off" ? (battery !== null && limit !== null && battery >= limit ? "At charge limit" : "Not charging") : "Status unavailable";
    this._text("status", status);
    const artwork = selectArtwork(c.artwork), image = c.vehicle_image || ARTWORK_IMAGES[artwork.image];
    this._el("scene").classList.toggle("custom-image", Boolean(c.vehicle_image));
    this._el("vehicle").alt = c.vehicle_image ? "Custom vehicle scene" : [artwork.modelLabel, artwork.years, artwork.trimLabel, artwork.paintLabel, artwork.interiorLabel, artwork.wheelLabel, artwork.view === "rear" ? "left rear view" : "front view"].join(" · ");
    if (this._el("vehicle").getAttribute("src") !== image) { this._vehicleAssetFailed = false; this._el("vehicle").hidden = false; this._el("asset-error").hidden = true; this._el("vehicle").src = image; }
    const showCable = !c.vehicle_image && !this._vehicleAssetFailed && artwork.port && plugged !== "off" && (plugged === "on" || charging);
    this._el("flow").toggleAttribute("hidden", !showCable);
    if (artwork.port) {
      const [x,y] = artwork.port;
      this._el("cable-route").setAttribute("d", `M 10 600 C 180 550 ${x - 210} 575 ${x - 95} 510 C ${x - 30} 475 ${x - 45} ${y + 60} ${x - 10} ${y + 7}`);
      this._el("charge-connector").setAttribute("transform", `translate(${x} ${y})`);
      this._el("cable-fade").setAttribute("x2", x); this._el("cable-fade").setAttribute("y2", y);
    }
    this._el("artwork-note").hidden = Boolean(c.vehicle_image) || Boolean(artwork.port);
    this._text("artwork-note", artwork.port ? "" : "Front view — charging cable is not shown for this artwork.");
    const power = quantity(e("power"), "power");
    const formatNumber = (n, digits = 1) => n === null ? "—" : new Intl.NumberFormat(h.locale?.language || "en", { maximumFractionDigits: digits }).format(n);
    const powerText = power === null ? "—" : `${formatNumber(power)} kW`;
    this._text("hero-power", powerText); this._text("power", powerText);
    this._text("battery", battery === null ? "—" : `${formatNumber(battery, 0)}%`);
    this._el("fill").style.width = `${battery ?? 0}%`;
    if (battery === null) this._el("track").removeAttribute("aria-valuenow"); else this._el("track").setAttribute("aria-valuenow", battery);
    this._el("track").setAttribute("aria-valuetext", battery === null ? "Unavailable" : `${battery}%`);
    this._el("marker").hidden = limit === null; this._el("marker").style.left = `${Math.min(100, Math.max(0, limit ?? 0))}%`;
    this._text("limit-label", limit === null ? "Limit unavailable" : `Limit ${formatNumber(limit, 0)}%`);
    this._text("limit-metric", limit === null ? "—" : `${formatNumber(limit, 0)}%`);
    let minutes = quantity(e("time_remaining"), "minutes");
    const completion = e("completion");
    let finish = completion && /^\d{4}-\d{2}-\d{2}T/.test(completion.state) ? Date.parse(completion.state) : NaN;
    if (Number.isFinite(finish)) minutes = Math.max(0, Math.ceil((finish - Date.now()) / 60000));
    else if (minutes !== null && minutes >= 0) finish = Date.now() + minutes * 60000;
    const validTime = charging && minutes !== null && minutes >= 0 && finish >= Date.now() - 60000;
    const roundedMinutes = Math.ceil(minutes ?? 0);
    this._text("remaining", validTime ? `${Math.floor(roundedMinutes / 60)} h ${roundedMinutes % 60} min` : "—");
    const otherDay = validTime && localDateTime(finish, zone).slice(0, 10) !== localDateTime(Date.now(), zone).slice(0, 10);
    this._text("finish", validTime ? new Intl.DateTimeFormat(h.locale?.language || "en", { timeZone: zone, hour: "2-digit", minute: "2-digit", ...(otherDay ? { day: "numeric", month: "short" } : {}) }).format(finish) : "—");
    const currency = c.currency || "AUD", rate = tariffRate(e("tariff"), currency);
    const costState = e("session_cost");
    const actualCost = costState?.attributes?.unit_of_measurement === currency ? numeric(costState) : null;
    const costs = estimateCosts({ tariff: rate, energy: quantity(e("session_energy"), "energy"), sessionCost: actualCost, remainingEnergy: quantity(e("remaining_energy"), "energy"), battery, limit, capacity: c.battery_capacity_kwh, efficiency: c.charging_efficiency ?? .9 });
    const money = value => value === null ? "—" : new Intl.NumberFormat(h.locale?.language || "en", { style: "currency", currency }).format(value);
    this._text("session-label", costs.estimatedSession ? "Session so far (est.)" : "Session so far");
    this._text("session-cost", money(costs.session)); this._text("remaining-cost", money(costs.remaining));
    this._text("session-note", costs.session === null ? "Configure session energy or cost" : costs.estimatedSession ? "Session energy × current rate" : "From session cost entity");
    this._text("estimate-note", costs.remaining === null ? "Needs tariff and remaining energy" : "Additional cost · at current rate");
    this._text("tariff", rate === null ? "Configure a tariff entity with a supported currency/kWh unit." : `Tariff: ${money(rate)}/kWh · estimates may change`);
    const busy = Boolean(this._pending);
    this._text("charge", busy ? "Waiting for Home Assistant…" : charging || e("charge")?.state === "on" ? "Stop charging" : "Start charging");
    this._el("charge").disabled = busy || !chargeValid || plugged === "off";
    for (const [id, key, suffix] of [["limit", "charge_limit", "%"], ["current", "charge_current", " A"]]) {
      const input = this._el(id), bounds = numberLimits(e(key));
      input.disabled = busy || !bounds;
      if (bounds) { input.min = bounds.min; input.max = bounds.max; input.step = bounds.step; }
      if (this.shadowRoot.activeElement !== input) { input.value = numeric(e(key)) ?? 0; this._text(`${id}-value`, numeric(e(key)) === null ? "—" : `${formatNumber(numeric(e(key)), 0)}${suffix}`); }
      this._text(`${id}-note`, bounds ? "" : "Entity unavailable or missing valid min/max/step");
    }
    const schedule = c.schedule;
    const armed = schedule && h.states[schedule.armed_entity]?.state === "on";
    const scheduleAvailable = schedule && [schedule.control_script, schedule.datetime_entity, schedule.armed_entity, schedule.status_entity].every(id => h.states[id] && !invalid.has(h.states[id].state));
    const savedTime = schedule && h.states[schedule.datetime_entity]?.state;
    const scheduleStatus = schedule && h.states[schedule.status_entity]?.state;
    this._text("schedule-label", `Start date and time · ${zone}`);
    this._text("schedule-summary", !scheduleAvailable ? "Configure the optional Home Assistant scheduling package." : armed ? `Scheduled: ${savedTime} (${zone})` : `Status: ${scheduleStatus}`);
    this._el("schedule-time").disabled = busy || !scheduleAvailable;
    this._el("schedule-time").min = localDateTime(Date.now() + 120000, zone);
    this._el("schedule-save").disabled = busy || !scheduleAvailable;
    this._el("schedule-cancel").disabled = busy || !scheduleAvailable || !armed;
    this._text("feedback", this._message || ""); this._el("feedback").classList.toggle("error", Boolean(this._error));
  }
  _checkPending() {
    if (this._pending?.predicate(this._hass)) { clearTimeout(this._pendingTimer); this._pending = null; this._message = "Confirmed by Home Assistant."; this._error = false; }
  }
  async _command(domain, service, data, predicate) {
    if (this._pending) return;
    const request = { predicate };
    this._pending = request; this._message = "Sending request…"; this._error = false; this._render();
    this._pendingTimer = setTimeout(() => { if (this._pending !== request) return; this._pending = null; this._message = "No state confirmation received. Check the entity before retrying."; this._error = true; this._render(); }, 20000);
    try {
      await this._hass.callService(domain, service, data);
      if (this._pending === request) {
        this._message = "Request sent; waiting for the entity to confirm.";
        this._checkPending();
      }
    } catch (error) { if (this._pending !== request) return; clearTimeout(this._pendingTimer); this._pending = null; this._message = error.message || "Home Assistant rejected the request."; this._error = true; }
    this._render();
  }
  _charge() {
    const id = this._config.entities.charge;
    if (!id || this._el("charge").disabled) return;
    const stop = chargingState(this._entity("charging"), this._entity("charging_status")) === "on" || this._entity("charge")?.state === "on";
    return this._command("switch", stop ? "turn_off" : "turn_on", { entity_id: id }, h => h.states[id]?.state === (stop ? "off" : "on"));
  }
  _number(key, value) {
    const entity = this._entity(key), bounds = numberLimits(entity), id = this._config.entities[key];
    if (!bounds || !Number.isFinite(value) || value < bounds.min || value > bounds.max || Math.abs((value - bounds.min) / bounds.step - Math.round((value - bounds.min) / bounds.step)) > 1e-6) { this._message = "Value is outside the entity's allowed range or step."; this._error = true; this._render(); return; }
    return this._command("number", "set_value", { entity_id: id, value }, h => numeric(h.states[id]) === value);
  }
  _schedule(command) {
    const s = this._config.schedule;
    if (!s) return;
    try {
      const timestamp = command === "schedule" ? scheduleTimestamp(this._draftSchedule, this._hass.config?.time_zone || "UTC") : undefined;
      return this._command("script", s.control_script.slice(7), { command, ...(timestamp !== undefined ? { timestamp } : {}) }, h => command === "cancel" ? h.states[s.armed_entity]?.state === "off" : h.states[s.armed_entity]?.state === "on" && Math.abs(Number(h.states[s.datetime_entity]?.attributes?.timestamp) - timestamp) < 1);
    } catch (error) { this._message = error.message; this._error = true; this._render(); }
  }
}
export class TessieCardEditor extends (globalThis.HTMLElement || class {}) {
  constructor() { super(); this.attachShadow?.({ mode: "open" }); this._vehicles = []; this._sequence = 0; }
  setConfig(config) { this._config = validateConfig(config); this._render(); }
  set hass(hass) {
    this._hass = hass;
    const connection = hass.connection || hass;
    if (connection !== this._connection) { this._connection = connection; this._load(); }
    this._render();
  }
  async _load(refresh = false) {
    const sequence = ++this._sequence;
    this._loading = true; this._error = ""; this._render();
    try { const vehicles = await loadVehicles(this._hass, refresh); if (sequence === this._sequence) this._vehicles = vehicles; }
    catch { if (sequence === this._sequence) { this._vehicles = []; this._error = "Vehicle detection failed. Refresh to retry, or use YAML entity mappings."; } }
    finally { if (sequence === this._sequence) { this._loading = false; this._render(); } }
  }
  _emit(config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: structuredClone(config) }, bubbles: true, composed: true }));
    this._render();
  }
  _render() {
    if (!this._config || !this._hass) return;
    if (!this._mounted) {
      this.shadowRoot.innerHTML = `<style>:host{display:block;color:var(--primary-text-color,#20252b);font:14px system-ui,sans-serif}*{box-sizing:border-box}label{display:block;margin:16px 0 6px}select,input,button{font:inherit;color:inherit;background:var(--ha-card-background,var(--card-background-color,#fff));min-width:0;border:1px solid var(--divider-color,#cbd1d8);border-radius:8px;padding:11px;width:100%}button{cursor:pointer;width:auto;margin:12px 0}p{font-size:13px;line-height:1.5;color:var(--secondary-text-color,#67717b)}.grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:12px}ul{padding-left:20px;overflow-wrap:anywhere}li{margin:7px 0}summary{cursor:pointer;margin-top:18px}#editor-status{margin:10px 0}input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--primary-color,#20b940);outline-offset:2px}</style>
        <label for="vehicle-picker">Tessie vehicle</label><select id="vehicle-picker"></select><p id="editor-status" role="status"></p><button id="refresh">Refresh vehicles</button>
        <label for="card-name">Card name (optional)</label><input id="card-name" placeholder="Use the vehicle name">
        <div class="grid"><div><label for="tariff-entity">Electricity tariff entity</label><input id="tariff-entity" list="tariff-options" placeholder="sensor.electricity_rate"><datalist id="tariff-options"></datalist></div><div><label for="currency">Currency</label><input id="currency" maxlength="3" placeholder="AUD"></div></div>
        <label for="capacity">Usable battery capacity in kWh (optional)</label><input id="capacity" type="number" min="0.1" step="any" placeholder="Needed for estimated remaining cost without an energy sensor">
        <style>.artwork-section{border:1px solid var(--divider-color,#dce0e5);border-radius:12px;padding:16px;margin-top:20px}.artwork-section h3{margin:0;font-size:17px}.artwork-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}.artwork-preview{margin:16px 0 0}.artwork-preview img{width:100%;aspect-ratio:1.6;object-fit:contain;display:block;border-radius:9px;background:color-mix(in srgb,var(--secondary-text-color,#67717b) 9%,transparent)}.artwork-preview figcaption{font-size:12px;line-height:1.5;margin-top:8px;overflow-wrap:anywhere}[hidden]{display:none!important}@media(max-width:360px){.artwork-grid{grid-template-columns:minmax(0,1fr)}}</style>
        <section class="artwork-section"><h3>Vehicle appearance</h3><p>Match the artwork to your vehicle. Charging controls continue to use the Tessie vehicle selected above.</p><div class="artwork-grid">
        <div><label for="artwork-model">Vehicle model</label><select id="artwork-model"></select></div><div><label for="artwork-generation">Generation</label><select id="artwork-generation"></select></div>
        <div><label for="artwork-trim">Vehicle trim</label><select id="artwork-trim"></select></div><div><label for="artwork-paint">Paint colour</label><select id="artwork-paint"></select></div>
        <div><label for="artwork-interior">Interior / trim colour</label><select id="artwork-interior"></select></div><div><label for="artwork-wheel">Wheels</label><select id="artwork-wheel"></select></div></div>
        <figure class="artwork-preview"><img id="artwork-preview" alt=""><figcaption id="artwork-caption"></figcaption></figure><p id="artwork-status" role="status"></p><button id="artwork-builtin" hidden>Use selected vehicle artwork</button></section>
        <p>Vehicle charging entities are detected automatically. Tariff and battery capacity are configured separately.</p>
        <details><summary>Detected entity mappings</summary><ul id="mapping-list"></ul></details><p>Use YAML for individual entity overrides, a custom scene or scheduling helpers. Selecting a different vehicle clears vehicle-specific mappings, capacity, artwork and scheduling, keeping your tariff and card name.</p>`;
      const get = id => this.shadowRoot.getElementById(id);
      get("vehicle-picker").onchange = event => {
        const config = { ...this._config, entities: { ...this._config.entities } };
        for (const key of [...Object.keys(tessieKeys), "time_remaining", "session_cost", "remaining_energy"]) delete config.entities[key];
        delete config.schedule; // Scheduling helpers are vehicle-specific; never carry them to another car.
        for (const key of ["battery_capacity_kwh", "charging_efficiency", "vehicle_image", "artwork", "subtitle"]) delete config[key];
        if (event.target.value) config.device_id = event.target.value; else delete config.device_id;
        this._emit(config);
      };
      get("refresh").onclick = () => this._load(true);
      for (const field of ARTWORK_FIELDS) get(`artwork-${field}`).onchange = event => {
        const config = { ...this._config, artwork: changeArtwork(this._config.artwork || DEFAULT_ARTWORK, field, event.target.value) };
        delete config.vehicle_image; this._emit(config);
      };
      get("artwork-builtin").onclick = () => { const config={...this._config}; delete config.vehicle_image; this._emit(config); };
      get("card-name").onchange = event => { const config = { ...this._config }; if (event.target.value.trim()) config.name = event.target.value.trim(); else delete config.name; this._emit(config); };
      get("tariff-entity").onchange = event => {
        const value = event.target.value.trim();
        if (value && !/^sensor\.[a-z0-9_]+$/.test(value)) { event.target.setCustomValidity("Choose a sensor entity ID."); event.target.reportValidity(); return; }
        event.target.setCustomValidity(""); const entities = { ...this._config.entities };
        if (value) entities.tariff = value; else delete entities.tariff;
        this._emit({ ...this._config, entities });
      };
      get("currency").onchange = event => {
        const value = event.target.value.trim().toUpperCase();
        if (value && !/^[A-Z]{3}$/.test(value)) { event.target.setCustomValidity("Use a three-letter currency code."); event.target.reportValidity(); return; }
        event.target.setCustomValidity(""); this._emit({ ...this._config, currency: value || "AUD" });
      };
      get("capacity").onchange = event => {
        if (!event.target.checkValidity()) { event.target.reportValidity(); return; }
        const config = { ...this._config };
        if (event.target.value) config.battery_capacity_kwh = Number(event.target.value); else delete config.battery_capacity_kwh;
        this._emit(config);
      };
      this._mounted = true;
    }
    const get = id => this.shadowRoot.getElementById(id), picker = get("vehicle-picker");
    this.style.colorScheme = this._hass.themes?.darkMode ? "dark" : "light";
    const selected = this._config.device_id || "";
    const options = [new Option("Automatic (only when one vehicle is found)", ""), ...this._vehicles.map(vehicle => new Option(`${vehicle.name}${vehicle.model ? ` · ${vehicle.model}` : ""}`, vehicle.id))];
    if (selected && !this._vehicles.some(vehicle => vehicle.id === selected)) options.push(new Option("Previously selected vehicle (not found)", selected));
    picker.replaceChildren(...options); picker.value = selected;
    const resolved = resolveVehicleConfig(this._config, this._vehicles);
    const issues = resolved.detectedVehicle?.ambiguous.length ? ` Ambiguous: ${resolved.detectedVehicle.ambiguous.join(", ")}.` : "";
    get("editor-status").textContent = this._loading ? "Detecting Tessie vehicles…" : this._error || (resolved.detectedVehicle ? `${resolved.detectedVehicle.name}: ${Object.keys(resolved.detectedVehicle.entities).length} mappings detected.${resolved.missing.length ? ` Missing: ${resolved.missing.join(", ")}.` : ""}${issues}` : requiredMappings.every(key => this._config.entities?.[key]) ? "Manual mappings active. Select a vehicle to switch to automatic detection." : this._vehicles.length > 1 ? `${this._vehicles.length} vehicles found. Select one for this card.` : "No Tessie vehicle found. Check the integration or use manual mappings.");
    get("refresh").disabled = Boolean(this._loading);
    const appearance = this._config.artwork || DEFAULT_ARTWORK, artwork = selectArtwork(appearance);
    for (const field of ARTWORK_FIELDS) {
      const select=get(`artwork-${field}`), options=artworkOptions(appearance,field);
      select.replaceChildren(...options.map(o=>new Option(o.label,o.value))); select.value=appearance[field];
    }
    const preview=get("artwork-preview"), image=this._config.vehicle_image || ARTWORK_IMAGES[artwork.image];
    if(preview.getAttribute("src")!==image)preview.src=image;
    preview.alt=this._config.vehicle_image ? "Custom vehicle artwork" : [artwork.modelLabel,artwork.paintLabel,artwork.interiorLabel,artwork.wheelLabel].join(" · ");
    get("artwork-caption").textContent=[artwork.modelLabel,artwork.years,artwork.trimLabel,artwork.paintLabel,artwork.interiorLabel,artwork.wheelLabel].join(" · ");
    get("artwork-status").textContent=this._config.vehicle_image ? "Your custom image is active. Choose an option or use the button below to show the selected artwork." : artwork.port ? "Rear view with charging cable animation. Only available downloaded combinations are offered." : "Full-car front view. A usable rear render was unavailable, so the charging cable is hidden for this configuration.";
    get("artwork-builtin").hidden=!this._config.vehicle_image;
    for (const [id, value] of [["card-name", this._config.name || ""], ["tariff-entity", this._config.entities?.tariff || ""], ["currency", this._config.currency || "AUD"], ["capacity", this._config.battery_capacity_kwh ?? ""]]) if (this.shadowRoot.activeElement !== get(id)) get(id).value = value;
    const tariffIds = Object.entries(this._hass.states).filter(([id, entity]) => id.startsWith("sensor.") && /\/kWh$/.test(entity.attributes?.unit_of_measurement || "")).map(([id]) => id).sort();
    get("tariff-options").replaceChildren(...tariffIds.map(id => new Option(id, id)));
    const items = Object.entries(resolved.entities).map(([key, id]) => { const item = document.createElement("li"); item.textContent = `${key}: ${id}`; return item; });
    if (resolved.detectedVehicle?.disabled.length) { const item = document.createElement("li"); item.textContent = `Disabled entities omitted: ${resolved.detectedVehicle.disabled.join(", ")}. Enable them in Home Assistant if needed.`; items.push(item); }
    get("mapping-list").replaceChildren(...items);
  }
}
if (globalThis.customElements && !customElements.get("tessie-card")) {
  customElements.define("tessie-card-editor", TessieCardEditor);
  customElements.define("tessie-card", TessieCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "tessie-card", name: "Tessie Card", description: "Vehicle charging, cost estimates and one-off start scheduling", preview: false });
}
