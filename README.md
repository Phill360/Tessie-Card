# Tessie Card

Initial build **0.1.0** of a custom Home Assistant charging card for the
[Tessie integration](https://www.home-assistant.io/integrations/tessie/).
Inspired by the rendered scenes and flow presentation in
[Sigenergy Flow Card](https://github.com/jyavenard/sigenergy-flow-card).

![Card preview](docs/build-preview.png)

## Included

- White 2025 Model 3, Nova wheels, black trim, rear-left three-quarter artwork with
  the cable connected at the left rear taillight. Separate disconnected artwork.
- Battery percentage, target marker, charging power, remaining time and finish time.
- Session cost and estimated additional cost to reach the limit, using a tariff entity.
- Always-visible start/stop, charge-limit and charging-current controls.
- One-off start date/time through an optional persistent Home Assistant package.
- Home Assistant theme colours, responsive layout, reduced-motion support,
  unavailable states, command-pending feedback and errors.
- No JavaScript dependencies, compilation, external fonts, or direct Tessie API token.

This build has automated local tests and a simulated browser demo. It has **not
yet been validated against a live Home Assistant/Tessie installation**. Entity IDs
must be mapped to your vehicle. Only the selected Model 3 artwork is bundled;
automatic model/trim discovery and other vehicle renders are not implemented yet.
Use `vehicle_image` for another complete scene.

## Install manually

1. Copy `tessie-card.js` and the `assets` directory into
   `/config/www/tessie-card/`, preserving the folder structure:

   ```text
   www/tessie-card/
     tessie-card.js
     assets/
       model-3-2025-white-nova.png
       model-3-2025-white-nova-disconnected.png
   ```

2. Add a dashboard resource (Settings > Dashboards > Resources):
   URL `/local/tessie-card/tessie-card.js?v=0.1.0`, type **JavaScript module**.
3. Add a manual card using [examples/card.yaml](examples/card.yaml), replacing
   every example entity ID with the real ID from Developer Tools > States.
4. Reload the dashboard. Increase the resource version query after updating files.

No HACS release is published yet. Configuration is YAML-only in this first build.

## Entity mappings

Configure under `entities:`. IDs are not derived from the vehicle name.

| Key | Domain | Purpose |
| --- | --- | --- |
| `battery` | sensor | Required; battery percentage |
| `charge` | switch | Required; charging enable/disable switch |
| `charge_limit` | number | Required; charge-limit control, using entity min/max/step |
| `charge_current` | number | Required; current control, using entity min/max/step |
| `charging` | binary_sensor | Actual charging status; recommended |
| `plugged_in` | binary_sensor | Cable connection; recommended |
| `power` | sensor | Charging power, W/kW/MW |
| `completion` | sensor | ISO timestamp of expected completion; preferred Tessie source |
| `time_remaining` | sensor | Alternative duration in s/min/h |
| `tariff` | sensor | Current electricity rate |
| `session_energy` | sensor | Energy added this session, Wh/kWh/MWh |
| `session_cost` | sensor | Optional persistent session-cost total in the configured currency |
| `remaining_energy` | sensor | Optional required **wall energy** to the limit, Wh/kWh/MWh |
| `location` | device_tracker | Optional header location |

The charge switch being on does not establish actual energy delivery; animation
and completion estimates use the `charging` binary sensor. Completion estimates
are hidden when charging is not confirmed. Missing readings show a dash, not zero.
Unknown controls are disabled. Sliders send a command on release, then wait for an
entity update. A 20-second timeout means no confirmation, not proof of failure.

## Cost configuration

Set `currency: AUD` (or another three-letter currency). Tariff units supported:
`AUD/kWh` for that currency, `c/kWh`, `¢/kWh`, or `AUDc/kWh`. Generic cents units
are interpreted as cents of the configured currency. Unsupported/missing units
are not guessed. Negative tariffs are supported.

**Session so far:** a configured `session_cost` entity in the matching currency
takes priority. Otherwise, session energy × current tariff is explicitly labelled
an estimate. This is not an accumulated variable-tariff bill: a tariff change can
reprice the whole estimate. Tessie session energy may represent energy added to
the battery rather than billed wall energy; check your source. For accurate cost,
supply a persistent server-side cost sensor that accounts for rate changes, wall
energy, and session boundaries. No browser-only cost accumulator is used.

**To charge limit:** additional cost from now, at the current tariff. Prefer a
`remaining_energy` sensor. Alternatively set your vehicle's verified usable
`battery_capacity_kwh` and `charging_efficiency` (default `0.9`). The estimate is
`max(0, limit − battery) / 100 × capacity / efficiency × tariff`. Capacity is never
assumed from the Model 3 name. This estimate does not forecast future tariff
changes. Missing input leaves the estimate unavailable.

## One-off scheduling

Install [examples/tessie_charging_package.yaml](examples/tessie_charging_package.yaml)
as an optional Home Assistant package. **Replace both occurrences of
`switch.my_tesla_charge`** with the same switch mapped to the card. Enable packages
in `configuration.yaml` if needed:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Merge this into an existing `homeassistant:` section; do not create a duplicate.
Put the package in `/config/packages/`, check the Home Assistant configuration,
then restart. Do not run automations manually as a validation step.

Add this to the card configuration:

```yaml
schedule:
  control_script: script.tessie_schedule_control
  datetime_entity: input_datetime.tessie_charge_start
  armed_entity: input_boolean.tessie_charge_start_armed
  status_entity: input_select.tessie_charge_schedule_status
```

The card accepts a date/time in Home Assistant's configured timezone, independent
of the browser timezone. Past times and ambiguous/nonexistent daylight-saving
times are rejected. The schedule persists in Home Assistant and runs with the
dashboard closed. Saving does not stop an already charging vehicle.

The package serializes saves, cancellations and execution. It consumes each start
before requesting charging, waits up to 45 seconds for charge-switch acknowledgement,
and reports Started or Failed. Started means the charge switch acknowledged the
request; active charging is still determined by the binary sensor. A missed start
is marked Missed rather than replayed on startup. Recovery runs each minute.
Execution within 60 seconds of the intended time is allowed; no implicit retries.
Cancellation cannot undo a start already sent to the vehicle. Each additional
vehicle needs its own separately named package and helpers.

The example package has not been exercised on a live Home Assistant installation;
run Home Assistant's configuration check before enabling it. Scheduling remains
visible but disabled if the package is absent.

## Local development

Requires Node.js 20 or later. No installation step:

```sh
node scripts/serve.mjs
node --test
```

Open `http://127.0.0.1:8124/` for the interactive demo. It simulates charging,
connected idle, charge-limit reached, disconnected, unavailable and command errors.
Controls never contact a real vehicle in the demo.

Optional browser checks use Playwright and a locally installed browser:

```sh
node scripts/browser-check.mjs /absolute/path/to/playwright/index.mjs msedge
```

The script starts its own test server on port 8125 and saves screenshots in
`test-results/`. Without arguments it uses an installed `playwright` package and
its default Chromium browser. CI runs the dependency-free unit tests and syntax check.

## Artwork and design

Vehicle scenes are generated approximations, not official Tesla renders. Prompt
records: [docs/vehicle-asset-prompts.md](docs/vehicle-asset-prompts.md).
`vehicle_image` accepts a local absolute URL or an HTTP(S) URL for a complete
scene; custom scenes disable the cable overlay animation. The bundled disconnected
scene is selected when `plugged_in` is off. A custom scene is used for all states.

The [design brief](docs/design-brief.md) records the agreed scope. Climate controls,
recurring schedules, charging history and multi-vehicle switching are outside
version one. Next validation is mapping real entities and checking behaviour on
the user's Home Assistant installation.
