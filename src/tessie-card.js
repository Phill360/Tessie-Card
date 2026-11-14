/* Tessie Card 0.1.1 — dependency-free Home Assistant dashboard card. */
export const VERSION = "0.1.1";
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
const domains = { battery: "sensor", charge_limit: "number", charge_current: "number", charge: "switch", charging: "binary_sensor", plugged_in: "binary_sensor", power: "sensor", completion: "sensor", time_remaining: "sensor", tariff: "sensor", session_energy: "sensor", session_cost: "sensor", remaining_energy: "sensor", location: "device_tracker" };
export function validateConfig(config) {
  if (!config?.entities || typeof config.entities !== "object" || Array.isArray(config.entities)) throw new Error("Configure entities for your Tessie vehicle.");
  for (const required of ["battery", "charge", "charge_limit", "charge_current"]) {
    if (!config.entities[required]) throw new Error(`Missing entities.${required}`);
  }
  for (const [key, id] of Object.entries(config.entities)) {
    if (!domains[key]) throw new Error(`Unknown entity mapping: ${key}`);
    if (typeof id !== "string" || !new RegExp(`^${domains[key]}\\.[a-z0-9_]+$`).test(id)) throw new Error(`entities.${key} must be a ${domains[key]} entity ID.`);
  }
  if (config.currency && !/^[A-Z]{3}$/.test(config.currency)) throw new Error("currency must be a three-letter code, e.g. AUD.");
  if (config.battery_capacity_kwh !== undefined && !(Number.isFinite(config.battery_capacity_kwh) && config.battery_capacity_kwh > 0)) throw new Error("battery_capacity_kwh must be positive.");
  if (config.charging_efficiency !== undefined && !(Number.isFinite(config.charging_efficiency) && config.charging_efficiency > 0 && config.charging_efficiency <= 1)) throw new Error("charging_efficiency must be between 0 and 1.");
  if (config.vehicle_image) {
    if (typeof config.vehicle_image !== "string" || !/^(https?:\/\/|\/(?!\/))/.test(config.vehicle_image)) throw new Error("vehicle_image must be an http(s) or local absolute URL.");
  }
  if (config.schedule) {
    for (const [key, domain] of Object.entries({ control_script: "script", datetime_entity: "input_datetime", armed_entity: "input_boolean", status_entity: "input_select" })) {
      if (!new RegExp(`^${domain}\\.[a-z0-9_]+$`).test(config.schedule[key] || "")) throw new Error(`schedule.${key} must be a ${domain} entity ID.`);
    }
  }
  return structuredClone(config);
}
const css = `
:host{display:block;--tc-green:#20b940;--tc-bg:var(--ha-card-background,var(--card-background-color,#fff));--tc-text:var(--primary-text-color,#20252b);--tc-muted:var(--secondary-text-color,#67717b);--tc-line:var(--divider-color,#dce0e5);font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif);color:var(--tc-text)}
*{box-sizing:border-box}ha-card{display:block;background:var(--tc-bg);border-radius:var(--ha-card-border-radius,20px);overflow:hidden;border:1px solid var(--tc-line);color:var(--tc-text)}
.head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px 0}.name{font-size:24px;font-weight:650;letter-spacing:-.6px}.sub,.note{color:var(--tc-muted);font-size:13px}.sub{margin-top:4px}.badge{border-radius:20px;padding:7px 12px;background:color-mix(in srgb,var(--tc-muted) 12%,transparent);font-size:13px;font-weight:600;white-space:nowrap}.active .badge{color:var(--tc-green);background:color-mix(in srgb,var(--tc-green) 13%,transparent)}
.scene{position:relative;aspect-ratio:1.92;overflow:hidden;background:radial-gradient(ellipse at 50% 90%,color-mix(in srgb,var(--tc-muted) 8%,transparent),transparent 65%)}.scene img{width:100%;height:100%;object-fit:contain;display:block}.scene .power{position:absolute;right:24px;top:16px;text-align:right;text-shadow:0 0 8px var(--tc-bg);font-size:13px;color:var(--tc-muted)}.power strong{display:block;font-size:21px;color:var(--tc-green);margin-top:3px}.scene.idle img{filter:saturate(.35)}.flow{position:absolute;bottom:13%;left:20%;width:13%;height:2px;background:linear-gradient(90deg,transparent,var(--tc-green),transparent);opacity:0}.active .flow{opacity:.8;animation:flow 2.5s ease-in-out infinite}@keyframes flow{0%{transform:translateX(0);opacity:0}50%{opacity:1}100%{transform:translateX(130%);opacity:0}}
.content{padding:0 22px 22px}.battery{display:flex;gap:20px;align-items:center;margin:10px 0 18px}.percent{font-size:36px;font-weight:650;letter-spacing:-1px}.battery-text{min-width:76px}.battery-track{flex:1;position:relative;padding-top:25px}.track{height:13px;border-radius:9px;background:color-mix(in srgb,var(--tc-muted) 18%,transparent);overflow:hidden}.fill{height:100%;width:0;background:var(--tc-green);border-radius:9px;transition:width .4s}.marker{position:absolute;top:18px;height:27px;border-left:2px solid var(--tc-text)}.limit-text{position:absolute;right:0;top:0;font-size:12px;color:var(--tc-muted)}
.metrics,.costs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid var(--tc-line);border-radius:13px;overflow:hidden;margin-bottom:12px}.metric{padding:13px 14px;min-width:0}.metric:nth-child(even){border-left:1px solid var(--tc-line)}.metric .label{font-size:12px;color:var(--tc-muted);display:block;margin-bottom:5px}.metric strong{font-size:20px;font-weight:600;display:block;font-variant-numeric:tabular-nums}.metric button{font:inherit;text-align:left;padding:0;border:0;background:none;color:inherit;cursor:pointer;width:100%}.costs strong{font-size:19px}.note{font-size:12px;margin:5px 0 0;line-height:1.4}.tariff{margin:-3px 0 17px}
button,input{font:inherit}button{cursor:pointer;border:1px solid var(--tc-line);color:var(--tc-text);background:color-mix(in srgb,var(--tc-muted) 8%,var(--tc-bg));border-radius:9px;padding:10px 14px;min-height:42px}button:disabled{opacity:.5;cursor:default}.primary{width:100%;background:var(--tc-green);border:0;color:#fff;font-weight:600;margin:0 0 14px}.control{margin:0 0 15px}.control label{display:flex;justify-content:space-between;font-size:14px;font-weight:550;gap:12px}.control output{font-variant-numeric:tabular-nums}input[type=range]{width:100%;accent-color:var(--tc-green);margin:12px 0 0;height:22px}input:disabled{opacity:.4}input[type=datetime-local]{width:100%;min-width:0;background:var(--tc-bg);color:var(--tc-text);border:1px solid var(--tc-line);border-radius:8px;padding:11px;margin:8px 0 10px;color-scheme:light}.dark input[type=datetime-local]{color-scheme:dark}.schedule{padding:14px;border:1px solid var(--tc-line);border-radius:13px}.schedule h3{font-size:16px;margin:0 0 5px;font-weight:600}.schedule label{font-size:12px;color:var(--tc-muted)}.schedule-actions{display:flex;gap:8px;flex-wrap:wrap}.schedule-actions button{flex:1}.feedback{font-size:13px;padding:10px 0 0;line-height:1.5}.error{color:var(--error-color,#c54242)}[hidden]{display:none!important}:focus-visible{outline:2px solid var(--tc-green);outline-offset:3px}.asset-error{padding:35px 24px;text-align:center;color:var(--tc-muted)}
@media(max-width:360px){.head{padding:18px 16px 0}.content{padding:0 14px 16px}.name{font-size:21px}.metric{padding:12px 10px}.metric strong{font-size:17px}.scene .power{right:16px;font-size:12px}.power strong{font-size:18px}.battery{gap:12px}.percent{font-size:32px}}
@media(prefers-reduced-motion:reduce){.active .flow{animation:none;opacity:.6}.fill{transition:none}}
/* Keep the power label above the render on narrow cards. */
.scene img{position:absolute;left:0;bottom:0;height:calc(100% - 34px)}
.scene .power{top:4px}
.flow{inset:34px 0 0;width:100%;height:calc(100% - 34px);background:none;opacity:1;pointer-events:none}
.active .flow{animation:none}
.flow path{fill:none;stroke:var(--tc-green);stroke-width:6;stroke-linecap:round;stroke-dasharray:20 1200;opacity:0}
.active .flow path{opacity:.9;animation:charge-flow 3s linear infinite}
@keyframes charge-flow{from{stroke-dashoffset:0}to{stroke-dashoffset:-1220}}
@media(prefers-reduced-motion:reduce){.active .flow path{animation:none;opacity:0}}
`;
export class TessieCard extends (globalThis.HTMLElement || class {}) {
  constructor() { super(); this.attachShadow?.({ mode: "open" }); this._draftSchedule = ""; }
  setConfig(config) { this._config = validateConfig(config); clearTimeout(this._pendingTimer); this._pending = null; this._message = ""; this._error = false; this._draftSchedule = ""; this._mounted = false; this._render(); }
  set hass(value) { this._hass = value; this._checkPending(); this._render(); }
  getCardSize() { return 14; }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }
  static getStubConfig() { return { type: "custom:tessie-card", name: "Model 3", entities: { battery: "sensor.my_tesla_battery", charge: "switch.my_tesla_charge", charge_limit: "number.my_tesla_charge_limit", charge_current: "number.my_tesla_charge_current" } }; }
  connectedCallback() { this._tick = setInterval(() => this._render(), 30000); this._render(); }
  disconnectedCallback() { clearInterval(this._tick); clearTimeout(this._pendingTimer); this._pending = null; }
  _entity(key) { return this._hass?.states[this._config?.entities[key]]; }
  _el(id) { return this.shadowRoot.getElementById(id); }
  _text(id, text) { this._el(id).textContent = text; }
  _more(key) { const entityId = this._config.entities[key]; if (entityId) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } })); }
  _mount() {
    this.shadowRoot.innerHTML = `<style>${css}</style><ha-card id="card"><header class="head"><div><div id="name" class="name"></div><div id="subtitle" class="sub"></div></div><span id="status" class="badge"></span></header>
      <div id="scene" class="scene"><img id="vehicle" alt="White 2025 Model 3 with Nova wheels, viewed from the left rear"><div id="asset-error" class="asset-error" hidden>Vehicle image unavailable. Configure vehicle_image or check the assets folder.</div><div class="power">AC charging<strong id="hero-power"></strong></div><svg id="flow" class="flow" viewBox="0 0 1792 896" aria-hidden="true"><path d="M 102 385 C 110 690 380 790 615 780 C 950 790 1075 600 1090 410"/></svg></div>
      <div class="content"><div class="battery"><div class="battery-text"><div id="battery" class="percent"></div><span class="sub">Battery</span></div><div class="battery-track"><span id="limit-label" class="limit-text"></span><div id="track" class="track" role="meter" aria-label="Battery charge" aria-valuemin="0" aria-valuemax="100"><div id="fill" class="fill"></div></div><div id="marker" class="marker" aria-hidden="true"></div></div></div>
      <div class="metrics"><div class="metric"><button id="power-info"><span class="label">Charging power</span><strong id="power"></strong></button></div><div class="metric"><button id="time-info"><span class="label">Time remaining</span><strong id="remaining"></strong></button></div><div class="metric"><button id="finish-info"><span class="label">Estimated finish</span><strong id="finish"></strong></button></div><div class="metric"><span class="label">Charge limit</span><strong id="limit-metric"></strong></div></div>
      <div class="costs"><div class="metric"><span id="session-label" class="label">Session so far</span><strong id="session-cost"></strong><p id="session-note" class="note"></p></div><div class="metric"><span class="label">To charge limit (est.)</span><strong id="remaining-cost"></strong><p id="estimate-note" class="note"></p></div></div><p id="tariff" class="note tariff"></p>
      <button id="charge" class="primary"></button>
      <div class="control"><label for="limit">Charge limit<output id="limit-value" for="limit"></output></label><input id="limit" type="range"><p id="limit-note" class="note"></p></div>
      <div class="control"><label for="current">Charging current<output id="current-value" for="current"></output></label><input id="current" type="range"><p id="current-note" class="note"></p></div>
      <section class="schedule"><h3>One-off start</h3><p id="schedule-summary" class="note"></p><label for="schedule-time" id="schedule-label">Start date and time</label><input id="schedule-time" type="datetime-local"><div class="schedule-actions"><button id="schedule-save">Schedule start</button><button id="schedule-cancel">Cancel start</button></div><p class="note">Saving a start time does not stop charging now.</p></section><div id="feedback" class="feedback" role="status" aria-live="polite"></div></div></ha-card>`;
    this._el("vehicle").addEventListener("error", () => { this._el("vehicle").hidden = true; this._el("asset-error").hidden = false; });
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
    if (!this._hass || !this._config || !this.shadowRoot) return;
    if (!this._mounted) this._mount();
    const c = this._config, h = this._hass, e = key => this._entity(key);
    const chargingState = e("charging")?.state;
    const charging = chargingState === "on"; // A charge switch being on is not proof of active charging.
    const plugged = e("plugged_in")?.state;
    const chargeValid = ["on", "off"].includes(e("charge")?.state);
    const batteryValue = numeric(e("battery"));
    const battery = batteryValue !== null && batteryValue >= 0 && batteryValue <= 100 ? batteryValue : null;
    const limit = numeric(e("charge_limit"));
    const zone = h.config?.time_zone || "UTC";
    const dark = h.themes?.darkMode ?? globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    this._el("card").className = `${charging ? "active" : ""} ${dark ? "dark" : ""}`;
    this._el("scene").classList.toggle("idle", !charging);
    this._text("name", c.name || "Model 3");
    this._text("subtitle", c.subtitle || `2025 · ${e("location")?.state && !invalid.has(e("location").state) ? e("location").state.replaceAll("_", " ") : "Tessie"}`);
    const status = charging ? "Charging" : plugged === "off" ? "Disconnected" : chargingState === "off" ? (battery !== null && limit !== null && battery >= limit ? "At charge limit" : "Not charging") : "Status unavailable";
    this._text("status", status);
    const image = c.vehicle_image || (plugged === "off" ? new URL("../assets/model-3-2025-white-nova-disconnected.png", import.meta.url).href : new URL("../assets/model-3-2025-white-nova.png", import.meta.url).href);
    this._el("flow").hidden = Boolean(c.vehicle_image) || !charging;
    if (this._el("vehicle").getAttribute("src") !== image) { this._el("vehicle").hidden = false; this._el("asset-error").hidden = true; this._el("vehicle").src = image; }
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
    const stop = this._entity("charging")?.state === "on" || this._entity("charge")?.state === "on";
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
if (globalThis.customElements && !customElements.get("tessie-card")) {
  customElements.define("tessie-card", TessieCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "tessie-card", name: "Tessie Card", description: "Vehicle charging, cost estimates and one-off start scheduling", preview: false });
}
