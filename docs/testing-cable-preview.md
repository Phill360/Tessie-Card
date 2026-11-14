# White Model 3 cable preview

This test build embeds the white Model 3 Highland render and draws the charging
cable separately. It runs without the downloaded artwork library or Tesla URLs.
The card type and existing entity configuration are unchanged.

## Test in Home Assistant

1. Copy the supplied `tessie-card.js` to
   `/config/www/tessie-card-test/tessie-card.js`.
2. In **Settings > Dashboards > Resources**, temporarily change the existing
   Tessie Card resource URL to:

   ```text
   /local/tessie-card-test/tessie-card.js?v=0.2.1
   ```

   Keep the resource type **JavaScript module**. Save the previous resource URL
   so you can restore it. Keep one Tessie Card resource registered: when two
   copies load, the first custom element registration wins.
3. Fully reload the dashboard. Keep your existing card and entity mappings.
   If your configuration sets `vehicle_image`, remove that override from the
   test card to see the bundled white Model 3 and animated cable.
4. Confirm these visual states with the vehicle's real reported states:

   | Vehicle state | Expected appearance |
   | --- | --- |
   | Charging | Green pulse moves along the cable towards the charge port |
   | Connected, idle | Cable remains visible without animation |
   | Disconnected | Cable, connector and charge flap overlay disappear |
   | Unknown connection and no confirmed charging | Cable is hidden |
   | Reduced motion enabled | Connected cable is static |

   The wall charger is absent in every state. The render is fixed to the white
   Model 3 for this test; automatic model/paint/wheel selection is not enabled.
5. Check the scene on your usual dashboard widths and in light and dark themes.

To roll back, restore the previous resource URL and fully reload the dashboard.
Version 0.2.1 is published as a GitHub prerelease for testing. In HACS, enable
prerelease versions and select 0.2.1 when redownloading the card, or use the
manual test installation above.

## Local simulation

From the project directory run `node scripts/serve.mjs`, then open
`http://127.0.0.1:8124/`. The simulated state selector can exercise the visual
states without contacting Home Assistant or a vehicle. Demo buttons only change
simulated data; buttons in Home Assistant retain their normal real controls.
