# Tessie Card 0.2.11 — Choose the graph period

The visual editor now offers a **Graph period** setting:

- **Past 24 hours**: the existing rolling window, still the default.
- **Today (midnight → now)**: starts at midnight in Home Assistant's configured
  timezone and resets automatically at the start of each local day.

The battery line, distance overlay, total kilometres, low/high values and time
labels all follow the selected period. Today handles daylight-saving changes,
including 23-hour and 25-hour days. Changing periods reloads both histories
immediately and discards responses from the previous period.

YAML options: `graph_period: today` or `graph_period: 24h`.
Existing configurations keep the past-24-hours view without changes.

Update to v0.2.11 in HACS, fully reload the dashboard, then choose the period in
the card's visual editor.
