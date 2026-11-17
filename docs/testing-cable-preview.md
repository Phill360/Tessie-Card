# Vehicle appearance test build (0.2.8)

This test build embeds 732 Model 3, Y, S, X and Cybertruck appearance configurations and draws
the charging cable separately. It runs without the original archive or Tesla URLs.
The card type and existing entity configuration are unchanged.

## Test in Home Assistant

1. Copy the supplied `tessie-card.js` to
   `/config/www/tessie-card-test/tessie-card.js`.
2. In **Settings > Dashboards > Resources**, temporarily change the existing
   Tessie Card resource URL to:

   ```text
   /local/tessie-card-test/tessie-card.js?v=0.2.8
   ```

   Keep the resource type **JavaScript module**. Save the previous resource URL
   so you can restore it. Keep one Tessie Card resource registered: when two
   copies load, the first custom element registration wins.
3. Fully reload the dashboard. Keep your existing card and entity mappings.
   If your configuration sets `vehicle_image`, remove that override from the
   test card to see the bundled artwork and animated cable. Edit the card and
   use Vehicle appearance to select model, generation, vehicle variant, paint,
   trim colour and wheels. Check that the preview updates and saved
   choices survive closing and reopening the card editor.
4. Confirm these visual states with the vehicle's real reported states:

   | Vehicle state | Expected appearance |
   | --- | --- |
   | Charging | Green pulse moves along the cable towards the charge port |
   | Connected, idle | Cable remains visible without animation |
   | Disconnected | Cable, connector and charge flap overlay disappear |
   | Unknown connection and no confirmed charging | Cable is hidden |
   | Reduced motion enabled | Connected cable is static |

   The wall charger is absent in every state. Front-view fallbacks hide the cable
   and are labelled. Appearance is selected manually and does not change which
   physical Tessie vehicle receives commands.
5. Compare Model Y 2020–2024 / Long Range AWD / Pearl White / All Black with
   both 19-inch Gemini and 20-inch Induction wheels. The car should keep the
   same size and the connector should remain on the left-rear charge port.
6. Try Model S/X with Cream trim and both wheel sizes. Check Cybertruck with
   Core and Mantle wheels and Tactical Grey/White trim; its cable should meet
   the port above the rear wheel.
7. Check the scene on your usual dashboard widths and in light and dark themes.

To roll back, restore the previous resource URL and fully reload the dashboard.
Version 0.2.8 is a test prerelease. It corrects vehicle sizing and cable alignment
across appearance options. In HACS, enable prerelease versions and select v0.2.8.

## Local simulation

From the project directory run `node scripts/serve.mjs`, then open
`http://127.0.0.1:8124/`. Expand Configure card appearance to try the artwork
selectors. The simulated state selector can exercise the visual
states without contacting Home Assistant or a vehicle. Demo buttons only change
simulated data; buttons in Home Assistant retain their normal real controls.

Historical Model S (2012–2016 original nose and 2016–2020 facelift) and Model X
(2015–2020) add 55 checked Black-interior paint/wheel choices. Model S uses front
views with the cable hidden; Model X uses calibrated rear views. Historical
variants are labelled Original exterior and do not claim trim/battery badges.
