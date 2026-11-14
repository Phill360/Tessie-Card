# Initial build validation

Build: 0.1.0.

- `node --test`: six tests pass. Covers missing/invalid measurements, power and
  energy units, tariff units and negative tariffs, session-cost precedence,
  remaining-cost assumptions, number-entity capabilities, configuration validation,
  and one-off times in the Home Assistant timezone, including DST gaps/overlaps.
- `node --check tessie-card.js`: passes.
- Headless Edge browser regression: passes. Covers simulated start/stop, number
  updates, one-off schedule/cancel, command rejection, missing entities/readings,
  persistent session-cost override, disconnected artwork, draft preservation,
  reduced motion, and no horizontal overflow at 320/390/768px.
- Light/dark desktop and narrow-screen screenshots visually reviewed.
- `git diff --check`: passes.

The Home Assistant package is an example awaiting the installation's configuration
check and live validation. No real vehicle commands or schedules were issued. The
browser tests simulate Home Assistant; they do not establish compatibility with
the user's exact entities, permissions, or Tesla firmware. No automatic vehicle
metadata discovery is implemented in this build. Only the selected Model 3 render
and a manual full-scene override are available.
