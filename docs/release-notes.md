# Tessie Card 0.2.2 — appearance picker test build

Adds a visual artwork picker covering 368 configurations across five Model 3
and Model Y generation groups, with 304 unique prepared vehicle images.

- Select model, generation, vehicle trim, paint colour, interior/trim colour and
  wheels in the card editor. A live preview shows the selected configuration.
- Dropdowns offer available downloaded combinations and preserve compatible
  choices when a parent changes. Saved appearance does not alter entity targeting.
- Changing the physical Tessie vehicle clears its previous appearance selection.
- Rear renders retain the animated cable; full-car front fallbacks are labelled
  and hide the cable. No wall charger is shown.
- Prepared transparent WebP images are deduplicated and embedded in the module,
  preserving the single-file HACS installation with no Tesla image requests.
- The approximately 18.3 MB card contains about 13.6 MB of compressed images.
  The original approximately 315 MB PNG archive remains local.
- The local demo includes the card editor so artwork can be tried without a car.

Validation: 15 automated tests, all prepared image checksums, and browser checks
covering dependent options, live previews, generation fallbacks, saved config,
entity isolation, controls, cable states, reduced motion and responsive themes.
This local build has not been validated against a live Home Assistant vehicle.

The 2018–2020 Model 3 rear-view code returned a taillight detail, so this group
uses front views. Three newer Model 3 configurations use front fallbacks where
rear requests failed. Other individual artwork discrepancies will be corrected
as they are discovered.
