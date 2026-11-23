# Tessie Card 0.2.10 — Distance driven overlay

The battery graph now overlays cumulative kilometres driven during the same
rolling 24-hour window, using the selected vehicle's recorded odometer readings.

- Amber distance line, kilometre axis on the right, and total distance badge.
- Automatic Tessie odometer detection, including renamed entities; manual
  mappings can set `entities.odometer` to a distance sensor.
- Converts odometers in miles or metres to kilometres.
- Missing history, unsupported units and odometer resets show an explanation
  instead of a misleading zero. Incomplete coverage is labelled as recorded
  distance rather than a full 24-hour total.
- Distance history follows the existing Show battery graph setting. Hiding the
  graph stops both battery and odometer history requests.

Home Assistant Recorder must include the battery and odometer sensors. The
battery graph remains available when odometer history cannot be loaded.

Update to v0.2.10 in HACS, then fully reload the dashboard. The standalone
`tessie-card.js` asset includes all required artwork and graph code.
