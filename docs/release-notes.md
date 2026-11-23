# Tessie Card 0.2.9 — Battery history and optional sections

- Adds a rolling 24-hour battery percentage graph with a teal history line,
  current charge limit, local time labels, and low/high summary.
- Adds **Show battery graph** and **Show schedule control** switches to the visual
  editor. Both default to shown. YAML options: `show_battery_graph: false` and
  `show_schedule: false`.
- Moves Start/Stop charging, charge limit and charging current directly below
  the battery level, before the charging metrics and costs.

The graph uses the mapped battery sensor's Home Assistant history and refreshes
every five minutes. Recorder must include that sensor. Unavailable readings
appear as gaps; hiding the graph stops history requests. Hiding the schedule
control does not cancel a charging start already saved in Home Assistant.

The standalone `tessie-card.js` release asset includes the vehicle artwork and
requires no additional graph card. Update to v0.2.9 in HACS, then fully reload
the dashboard. Existing entity mappings, artwork and scheduling helpers remain
compatible.
