# Test release validation

Build: 0.2.8 (test prerelease).

- `node --test`: twenty-three tests pass. Covers missing/invalid measurements, power and
  energy units, tariff units and negative tariffs, session-cost precedence,
  remaining-cost assumptions, number-entity capabilities, configuration validation,
  and one-off times in the Home Assistant timezone, including DST gaps/overlaps.
  Discovery tests cover platform/device boundaries, renamed entities, duplicate
  mappings, disabled entities, one/multiple vehicle selection, manual overrides,
  charging-state fallback, registry caching/retry and the standalone HACS bundle.
  Artwork tests verify every prepared file checksum, configuration coverage,
  cascading option compatibility and invalid-combination rejection.
- `node --check tessie-card.js`: passes.
- Headless Edge browser regression: passes. Covers simulated start/stop, number
  updates, one-off schedule/cancel, command rejection, missing entities/readings,
  persistent session-cost override, static connected cable, hidden disconnected
  cable, moving charging pulse, draft preservation, reduced motion, custom-image
  suppression, failed-image handling, and no horizontal overflow at 320/390/768px.
  Visual editor checks cover selecting either of two vehicles, command isolation,
  clearing vehicle-specific settings when switching, live entity renames, device
  removal without fallback, failed registry access/retry, and 320px editor layout.
  Appearance checks cover model/generation/trim/paint/interior/wheel changes,
  preview image decoding, full-car front fallbacks, retained entity targeting,
  clearing appearance when changing physical car and the live demo editor.
- Light/dark desktop and narrow-screen screenshots visually reviewed.
- `git diff --check`: passes.

The Home Assistant package is an example awaiting the installation's configuration
check and live validation. No real vehicle commands or schedules were issued. The
browser tests simulate Home Assistant; they do not establish compatibility with
the user's exact entities, permissions, or Tesla firmware. Vehicle and entity
discovery use simulated registry fixtures and the official Tessie entity metadata.
Automatic paint/wheel matching is not implemented. A visual artwork picker covers
732 configurations with 590 unique prepared renders. A manual full-scene override
remains available. The approximately 37 MB module embeds the prepared images;
the original PNG source archives are not shipped.

For the 0.2.3 framing correction, all 304 decoded WebP images were checked against
the original Model Y Gemini reference. Dominant car widths are 835–837 pixels on
the 1000-pixel canvas; left edges are 83–84 and top edges 67–68. The preparation
step ignores isolated opaque pixels rather than fitting the source canvas.
Image scale and offsets also determine each cable anchor. Regression fixtures
cover compositor noise, source padding/scale and Gemini/Induction registration.
Browser screenshots compare the reported white/black-interior Model Y with
19-inch Gemini and 20-inch Induction wheels at the same viewport.

The 0.2.4 update adds the original Model Y RWD as an explicit alias of matching
Long Range artwork, without adding duplicate images. Browser checks exercise
RWD selection and verify Black/White-only trim colour labels. Duplicate interior
option codes are grouped by colour while existing selections remain valid.

The 0.2.5 update removes the idle image saturation filter. Browser checks verify
that Ultra Red and Red Multi-Coat have no CSS colour filter, and that the same
Red Multi-Coat image is displayed while charging, idle and disconnected. The
idle screenshot was visually checked against the original/editor colour.

The 0.2.6 Model 3 Highland Long Range RWD selection aliases every matching RWD
Premium paint, trim colour and wheel combination. Browser checks confirm the
same image and connector placement, along with saved selection and entity isolation.

The 0.2.7 update displays Long Range RWD (Premium) in the Model 3 variant
selector while retaining the saved LR_RWD code and existing artwork mappings.

The 0.2.8 artwork preparation adds Model S/X and Cybertruck. All 1,404 downloaded
source files passed checksum, PNG chunk CRC and pixel-data integrity checks, with
no suspicious identical renders across different paint, wheel or cabin colours.
Twelve Model S cabin requests and one Cybertruck cabin request are unavailable;
all new exterior combinations are prepared. The original Model 3/Y image data
is reused without re-encoding. Version v0.2.8 is designated as a HACS test prerelease.

The complete 0.2.8 decoded-image audit covers 590 WebPs: body widths 835–838
pixels, left edges 83–84 and top edges 66–68 on the 1000-pixel canvas. White,
black and stainless-steel contact sheets were reviewed for framing and port
placement. The bundled module embeds all prepared vehicle images. All 23 automated tests pass.
Browser checks also passed for all three added vehicle families, including
Cream trim, Cybertruck White trim, Core/Mantle switching and connected cables.

Historical Model S (2012–2016 original nose and 2016–2020 facelift) and Model X
(2015–2020) add 55 checked Black-interior paint/wheel choices. Model S uses front
views with the cable hidden; Model X uses calibrated rear views. Historical
variants are labelled Original exterior and do not claim trim/battery badges.

Historical picker verification passed: all 23 automated tests and browser checks,
including Black-only cabin choices, paint/wheel switching, front-view cable
suppression for both earlier S styles and the calibrated rear cable for earlier X.
All 590 decoded prepared images pass the framing audit (widths 835–838, left
83–84, top 66–68). The reproducible bundle is 37,024,113 bytes. The three
historical browser scene previews were visually reviewed.
