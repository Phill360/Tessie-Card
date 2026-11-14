# Tessie Card 0.2.0

- Visual card editor with a dropdown of vehicles from the Tessie integration.
- Automatic charging-entity mappings based on device and integration metadata,
  supporting renamed entities while keeping multiple vehicles separate.
- A single vehicle can be selected automatically; with more than one, choose the
  vehicle in the editor. Explicit device selection is saved to the dashboard.
- Manual entity overrides remain supported. Tariff and capacity settings are
  separate; changing vehicle clears vehicle-specific mappings and scheduling.
- Tessie charging-state sensor fallback supports installations where the charging
  binary sensor is disabled by default. No entities are enabled automatically.
- Registry refresh, missing/ambiguous entity feedback, and safe handling of
  removed devices. Existing fully manual card configurations still work.

Update through HACS, reload the browser, then edit the card to select your vehicle.
The bundled artwork remains the white Model 3. No live Home Assistant/Tessie
installation was used for validation; automated registry fixtures and browser
tests cover discovery, editor interaction, rename/removal and failure recovery.
