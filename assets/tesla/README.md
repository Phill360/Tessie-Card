# Local Tesla artwork library

This archive stores original Tesla compositor PNGs in the repository workspace.
The card does not make requests to Tesla or include this whole library in its
JavaScript bundle. Integration and selection of production assets are separate.

## Requested batch

The current batch is limited to **Model 3 and Model Y**, including exterior
paint/wheel/interior-colour combinations, front and rear views, cabin interiors,
and wheel close-ups. Cabin views also cover the catalogued seating and steering
options. Paint and wheel combinations are not repeated for cabin close-ups.

| Vehicle | Source catalog generation groups |
| --- | --- |
| Model 3 | 2018–2020; 2021–2023; 2024–2026 (Highland) |
| Model Y | 2020–2024; 2025–2026 (Juniper) |

Year groups, trim names and option names come from the reference catalog; they
are not Tesla guarantees that each configuration was sold in every year or
market. Regional and discontinued options absent from that catalog are not
claimed as complete coverage. Server success alone does not establish that all
options were honoured. Downloaded combinations remain pending visual review
unless explicitly checked. Files with the same SHA-256 are linked in the manifest
because Tesla can return the same image for multiple option requests.

## Browse and reproduce

- Open `library/index.html` after generating the local gallery.
- `library/manifest.json` records each URL, requested options, status, size,
  dimensions, checksum and download time. Errors are recorded as unavailable;
  they are never saved as image files.
- `library/plan.json` records the requested combinations.
- `library/summary.json` reports downloaded and unavailable counts by generation.

```sh
node scripts/download-tesla-assets.mjs --model=m3,my --sample --concurrency=2
node scripts/download-tesla-assets.mjs --model=m3,my --concurrency=2
node scripts/create-tesla-gallery.mjs
node scripts/verify-tesla-assets.mjs
```

The downloader resumes completed files and retries previously failed requests.
Use `--plan-only` to list the work without network access. All PNG downloads are
checked for a valid header, dimensions, complete chunks and decompressible pixel
data. Gallery images load from local relative paths, including when opened
directly from disk. No remote scripts or fonts are used.

`library/verification.json` records full-file SHA-256 and PNG chunk CRC checks,
decompression checks, duplicate groups and potentially ignored option requests.
The initial fifteen exterior/cabin/wheel samples across all five groups were
visually checked; their contact sheet is `docs/tesla-model-3-y-sample-sheet.png`.
An additional fifteen rear/interior/wheel samples were checked in
`docs/tesla-model-3-y-options-sheet.png`. For the 2018–2020 Model 3 profile,
Tesla's `STUD_REAR` code returns a taillight close-up. The gallery labels those
files as detail views; the manifest preserves the originally requested category.

## Sources and ownership

- Image source: `https://static-assets.tesla.com/configurator/compositor` and
  `https://static-assets.tesla.com/v1/compositor/`.
- Option mapping reference:
  https://github.com/tn9design/tesla-vehicle-config-decoder
- The downloaded mapping reference is in `catalog/reference-configurator.html`,
  with its MIT license in `catalog/reference-LICENSE.txt`; the static model data
  is extracted to `catalog/models.json` without executing the reference script.
- Tesla artwork remains owned by Tesla. The mapping reference's MIT license
  does not grant redistribution rights to Tesla's images.

The earlier three original Model Y wheel samples are retained in
`model-y-2022/`. They are separate from the generated library.
