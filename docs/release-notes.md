# Tessie Card 0.1.1

- Install through HACS as a custom **Dashboard** repository.
- Both vehicle scenes are embedded in the single `tessie-card.js` download;
  no additional image folders are required.
- Charging controls, tariff-based cost estimates and the optional server-side
  one-off scheduling package are retained from the initial build.

Add `https://github.com/Phill360/Tessie-Card` under HACS > Custom repositories,
choose Dashboard, then download Tessie Card. Reload the browser and add a manual
`custom:tessie-card` using the entity mappings in the README.

Remove the old manual dashboard resource before switching to HACS to avoid loading
two card versions. YAML-mode resource URL: `/hacsfiles/Tessie-Card/tessie-card.js`.

The scheduling package is optional and is not installed by HACS. Live Home
Assistant/Tessie validation and automatic vehicle-configuration discovery remain
follow-up work. This release is not listed in the HACS default catalogue.
