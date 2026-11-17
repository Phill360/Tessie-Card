# Pre-2021 Model S / Model X source archive

Downloaded directly from Tesla's `https://static-assets.tesla.com/v1/compositor/`
image service. Historical option-code candidates come from:
https://github.com/timdorr/tesla-api/blob/master/docs/vehicle/optioncodes.md

The source's HTTP success does not prove that every option was honoured.
The separate `assets/tesla/library/pre-2021/` archive contains original files,
request URLs, checksums, verification and quality reports, and an offline gallery.
The checked Black-seat exterior subset is prepared for the card picker: 55
paint/wheel configurations. Other requested cabin colours and rejected files
remain in the source archive. Model S uses front views with no cable; Model X
uses rear views with a separately calibrated charge port.

Representative samples visually checked:

- Model S original nose: `STUD_3QTR`.
- Model S 2016–2020 facelift: `STUD_3QTR_V2`.
- Original Model X: `STUD_3QTR` and `STUD_REAR`.

Known limitations:

- Model S `STUD_REAR` returns an incomplete car with missing glass/lamp parts.
  It is retained only in the discovery directory, not the variant library.
- Requested Model X `STUD_INTERIOR` renders are almost empty and rejected by
  the quality review. Original files are preserved for troubleshooting.
- Some cabin-colour requests return identical bytes; their labels describe
  requested options, not verified interior colours. Review flags identify them.
- Wheel close-up requests may be unavailable even when exterior wheel variants
  render successfully.
- Historical exterior appearance groups do not claim exact trim or battery badges,
  all year-specific changes, or every discontinued paint/wheel option.

Reproduce downloads with:

```
node scripts/download-tesla-assets.mjs --catalog=assets/tesla/catalog/legacy-models.json --archive=assets/tesla/library/pre-2021 --concurrency=2
node scripts/verify-tesla-assets.mjs assets/tesla/library/pre-2021
node scripts/review-legacy-tesla.mjs <absolute-path-to-sharp/index.mjs>
node scripts/create-tesla-gallery.mjs assets/tesla/library/pre-2021
```

Download result: 234 PNG files (84 unique, 94,742,889 bytes), 11 HTTP 412
requests. All downloaded PNGs pass checksum/chunk/pixel integrity verification.
Three almost empty Model X cabin files are rejected and hidden from the gallery.
The remaining 231 files contain 81 unique images. Exterior requests across the
three cabin-colour codes returned identical pixels and carry explicit warnings.
Representative white-paint samples of all 11 wheel/body combinations were
visually checked in wheel-contact-sheet.png.
