# Charging card design brief

Status: initial build 0.1.0 implemented locally, with simulated browser validation.
Not yet validated on a live Home Assistant installation. Concept images use
illustrative readings; `build-preview.png` shows the running demo.

## Confirmed direction

- Focus the first version on charging details.
- Take visual inspiration from [Sigenergy Flow Card](https://github.com/jyavenard/sigenergy-flow-card): a rendered scene, power-flow indicators, and supporting measurements.
- Use realistic vehicle renders with a presentation similar to the Tesla app.
- Match the artwork to the vehicle model, with automatic selection and manual override.
- Explore the design with the user before finalising the interface.

## Confirmed configuration and version-one scope

- White 2025 Tesla Model 3 with Nova wheels and black trim, three-quarter view.
- One vehicle per card. Follow Home Assistant light/dark mode.
- Charger-to-car flow only. No external solar/charger power entities available.
- Always show battery percentage, charge limit, kW, remaining time, estimated
  completion time, and cost.
- Always-visible start/stop, charge-limit, charging-current, and scheduling controls.
- Follow the reference card's responsive desktop/phone approach; no fixed width chosen.
- Rendered scene, animated flows, typography, tiles, and charts all appeal to the
  user, but charging history is explicitly excluded from version one.
- No existing dashboard palette to match.
- Cost: show session cost so far and estimated additional cost to reach the charge
  limit, using a configured Home Assistant tariff entity.
- Scheduling: one-off start date/time; no recurring weekdays or stop-time controls.

These decisions supersede concepts v1 and v2 where they differ. Use battery
progress and live power-flow graphics; defer history charts.

## Proposed composition

1. Header: vehicle name, charging state, and connection/location context.
2. Hero: model-specific three-quarter vehicle render with a charger and a subtle
   directional power-flow path. Show charging power beside the path.
3. Battery: current percentage and progress track with an
   independently positioned charge-limit marker.
4. Completion: remaining time and estimated completion time.
5. Cost row: "Session so far" and "To charge limit (est.)", with the active tariff
   and its currency/kWh unit below. The latter means additional cost from now.
6. Always-visible controls: start/stop charging, charge-limit slider, and current slider.
7. One-off scheduling: date and local time inputs, "Schedule start" action, and
   a summary with "Cancel start" once saved. No weekdays or stop-time fields.

Concept v1's Model Y is superseded by the confirmed Model 3 configuration.
Use a vehicle-centred scene with a charger; no solar, grid, or home battery nodes.

## Interaction proposal

- Tapping a measurement opens the corresponding Home Assistant entity details.
- Charge-limit changes require explicit release/apply rather than a command for
  every slider movement. Reflect the entity's actual allowed range and step.
- Distinguish a requested command from a confirmed entity state. Show pending
  feedback and an actionable error if a command fails.
- Stop flow animation while idle; honour reduced-motion preferences.
- Keep all four requested controls visible, including current and scheduling.
- On narrow screens, keep the vehicle, battery, and completion information above
  secondary measurements. Avoid horizontal scrolling.

## Display states

Design charging, plugged-in idle, scheduled/waiting, complete, disconnected,
unavailable, and command-pending states. Confirm which can be identified from the
actual entities before assigning labels. Unknown readings must not become zero.
Hide optional unconfigured measurements; explain configured-but-unavailable data.
Do not display a completion estimate when no valid estimate is available.

## Vehicle artwork

Charge-port accuracy: use the vehicle's left rear corner, with the socket behind
the flap integrated into the left rear taillight assembly. Never attach the cable
to the right flank or a generic opening on the rear quarter panel. Use a rear-left
three-quarter view to make this placement visible in both theme variants. This
refines the earlier three-quarter artwork direction after the user's correction.
[Tesla charge-port reference](https://www.tesla.com/ownersmanual/model3/en_us/GUID-BEE08D47-0CE0-4BDD-83F2-9854FB3D578F.html).

Select assets by model, generation, paint, and wheels where supported. Allow a
manual image override and a neutral fallback for an unmatched vehicle. Automatic
configuration detection is a proposal until actual entity metadata is checked.
The preview uses generated artwork, not an official Tesla image or an exact
configuration guarantee. Confirm the source and reuse terms of any production
Tesla renders before packaging them. Keep model artwork independent of light/dark
surfaces where possible.

## Data boundaries

Read states and invoke actions through Home Assistant's existing Tessie
integration. No direct Tessie token belongs in the card. Verify actual entity IDs,
units, capabilities, and update behaviour before implementation.

Charging power, energy added, current, voltage, battery level, range, charge limit,
and remaining-time bindings need confirmation on a real installation. Treat power
and stored energy as different quantities. If an estimated finish time is derived
from remaining time, label it as estimated. Solar attribution and charging cost
require additional configured sources; do not infer them from vehicle power.

Integration reference: [Home Assistant Tessie documentation](https://www.home-assistant.io/integrations/tessie/).

## Questions issued for design review

1. First vehicle models and years?
2. Paint, wheels, and trim?
3. One vehicle per card or vehicle switching?
4. Does "card type" mean the vehicle model?
5. Front three-quarter, side, or garage-scene artwork?
6. Which reference features matter most: scene, flows, typography, tiles, charts?
7. Charger-to-car only, or solar/grid/home battery too?
8. Which charging figures must always be visible?
9. Include charging history in version one?
10. Primary device and available card width?
11. Which charging controls are required?
12. Visible controls or tap-to-open controls?
13. Follow Home Assistant theme or fixed theme?
14. Automatic vehicle artwork selection and manual override?
15. Are solar and charger power entities available?
16. Existing dashboard styling to match?

## Next design pass

Concept v2 shows the confirmed Model 3. Its single cost tile and recurring schedule
panel are superseded by the confirmed cost row and one-off scheduling above.

Actual session cost needs trustworthy session energy and tariff data. Variable
tariffs require time-aligned energy increments, not the latest rate multiplied by
all historical energy. Define session boundaries and persistence before coding.
Without a tariff, keep the cost position with a setup prompt instead of zero.

Use tariff units to distinguish currency/kWh from cents/kWh; never assume dollars.
Session cost should persist outside the browser and account for rate changes.
If complete session energy/rate history is unavailable, label the result as an
estimate or unavailable instead of presenting an exact cost. Card visibility must
not determine which charging intervals are counted.

Estimate additional cost from remaining energy and the current tariff, explicitly
labelled "At current rate". Do not imply future tariff forecasting. Remaining
energy needs a verified source or configured usable capacity and a documented
loss assumption; battery percentage and tariff alone are insufficient. With no
trustworthy energy estimate, show an unavailable estimate while preserving layout.

The schedule panel in v2 is superseded, not a confirmed schedule API.
Verify the installed Tessie actions: a scheduled-charging status sensor does not
establish a writable scheduling API. Do not use Teslemetry actions for Tessie.
If Home Assistant automation is needed, settle behaviour and persistence first.
This design work creates no schedules or vehicle commands.

Persist a one-off start in Home Assistant, not a browser timer. Specify an explicit
date and time in Home Assistant's configured timezone, show the saved timestamp,
reject past/invalid times, and allow cancellation. Never imply that saving a future
start also stops an already charging car. The scheduled action must execute once,
mark itself consumed, and report failed/skipped execution. After downtime, a
missed start should be marked missed rather than silently starting late. Verify
this behaviour against the chosen Home Assistant scheduling mechanism.

Implementation prerequisites: actual tariff entity ID and unit, session energy
source, remaining-energy source/capacity, and supported scheduling mechanism.
These do not block visual design; no live configuration has been changed.

Match the 2025 Nova wheel design, rather than substituting newer Dark Nova wheels.
If automatic metadata is insufficient, require explicit configuration rather than
guessing. Generated artwork is approximate; verify production asset accuracy.
[Tesla Nova wheel reference](https://service.tesla.com/docs/Model3/ServiceManual/2024/en-us/GUID-769C9625-76EE-467B-B756-C9032AC2B99A.html).

Implemented: responsive custom card, connected/disconnected artwork, charging
controls, cost estimates, optional server-side one-off scheduling package, and
interactive demo. Unit and browser checks cover core calculations and controls.
Next: map the user's real entities and validate the optional package using Home
Assistant's configuration check. Version 0.2.0 adds a vehicle picker and registry
entity discovery. Automatic paint/wheel matching and additional vehicle renders
remain follow-up work; a manual scene override is supported.
