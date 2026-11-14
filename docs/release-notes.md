# Tessie Card 0.2.1 — test prerelease

Replaces the generated car-and-charger scene with a locally embedded white
Model 3 Highland render with Nova wheels and a separate animated charging cable.
The wall charger is no longer visible.

- Green pulse moves along the cable towards the car during confirmed charging.
- Connected idle keeps a static cable; disconnected hides the cable and plug.
- Unknown connection states hide the cable unless charging is confirmed.
- Reduced-motion settings keep the connected cable static.
- Custom vehicle images retain their own scene without the built-in cable overlay.
- The render is embedded in the standalone module. No Tesla image URLs or
  additional image downloads are needed when using the card.

The test render is fixed to the white Model 3. Automatic paint, wheel and model
selection from the downloaded artwork library is not part of this release.

Validation: 12 automated tests plus browser checks for animation progression,
connection states, reduced motion, custom artwork, failed-image handling,
responsive light/dark layouts, controls, scheduling and vehicle discovery.
Validation used simulated Home Assistant data; live installation testing remains.

For HACS testing, enable prerelease versions and redownload 0.2.1, then fully
reload the browser. Existing card configuration and entity mappings are retained.
Remove any vehicle_image override from the test card to see the bundled render.
