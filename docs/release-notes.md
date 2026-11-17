# Tessie Card 0.2.8 — Model S, Model X and Cybertruck artwork

Adds locally stored Tesla exterior renders to the vehicle appearance picker:

- Model S: original 2012–2016 nose, 2016–2020 facelift, and 2021 onward source groups.
- Model X: original 2015–2020 and 2021 onward source groups.
- Cybertruck: Dual Motor AWD, Premium AWD and Cyberbeast source variants, stainless
  steel, Core/Mantle wheels and available Tactical Grey/White cabin combinations.

Modern Model S/X offer Black, White and Cream cabin colours. Historical models
offer only verified Black cabin artwork and an Original exterior appearance
selection, without claiming trim/battery badges. Their 55 paint/wheel combinations
use 55 additional prepared images. Model S historical renders are front views
with the cable hidden; historical Model X uses a calibrated rear charging view.
Existing Model 3/Y choices
and saved appearance settings are retained. All exterior renders use the same
vehicle width and top position, with family-specific charging-port registration.
Cybertruck's cable connects above the rear wheel.

The local source archive also includes cabin and wheel close-ups. Tesla rejected
12 Model S cabin requests and one Cybertruck cabin request; these are recorded as
unavailable. Every requested new exterior combination downloaded successfully.
Generation labels identify source groups, not a guarantee of every historical
model-year detail. The library now has 732 configurations and 590 unique renders.

The new assets are embedded in the single-file card for testing; the original PNG
archive is retained locally and is not shipped. In HACS, enable prerelease
versions, select v0.2.8, download the update and fully reload the dashboard.
