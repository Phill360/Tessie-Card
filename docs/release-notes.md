# Tessie Card 0.2.5 — preserve original paint colours

Removes the idle-state saturation filter that made red vehicles appear dark and
muted in the card while their editor preview retained the original paint colour.

- Vehicle colours now stay faithful to the prepared Tesla render when charging,
  idle or disconnected. Red Multi-Coat and Ultra Red are covered by browser checks.
- The same image is retained across connection states; only charging indicators
  and the cable change appearance.
- Vehicle sizing, cable registration, trim colour and RWD options are unchanged.

Validation: 20 automated tests plus browser checks, including red paint colour
and image consistency across charging, idle and disconnected states.
Install the v0.2.5 test prerelease in HACS and fully reload the dashboard.
