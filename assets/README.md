# Vehicle artwork

## Current bundled catalog

`vehicles/catalog.json` lists 388 available full-car configurations across Model
3 and Model Y generations. There are 304 unique prepared transparent WebP images
under `vehicles/`; they are normalized to a 1000 x 625 canvas and embedded into
the standalone JavaScript module. `vehicles/sources.json` records the original
Tesla URL and source checksum for every configuration.

`scripts/prepare-vehicle-artwork.mjs` prepares the catalog from the original local
PNG archive using Sharp. It verifies original checksums, trims transparent space,
measures the largest opaque car silhouette (ignoring isolated compositor pixels),
fits the vehicle into the Gemini reference frame, and writes the WebP files and generated
`src/vehicle-artwork-data.js`. The runtime has no Sharp dependency. Use the
`--reuse-images` flag when recalibrating metadata without changing image encoding.

`vehicles/framing.json` stores the reference vehicle bounds and port calibration.
Each prepared file records its source bounds, scale, offset and measured final
bounds. Rear configuration anchors are projected through that same transform,
so changes in source padding cannot move the car away from its cable.
The 2018–2020 Model 3 group and three newer
Model 3 combinations use full-car front fallbacks; their cable overlay is hidden.
Source option labels are retained; individual option fidelity can be corrected
as discrepancies are discovered. A valid checksum does not certify fidelity.

The prepared images total about 14.2 MB; the self-contained module is about
19.1 MB because the images are base64 encoded. Shared image data is included
once per unique source image, and only selected images are decoded for display.
The original approximately 315 MB archive stays outside Git and the card bundle.

## Previous single-render release (0.2.1)

`model-3-highland-white-nova.png` is an unchanged Tesla compositor PNG, copied
from the local library's Model 3 / modern / MT370 / PPSW / W39G / IPB3 /
STUD_REAR34 configuration. It shows a white Model 3 Highland, Nova wheels,
black interior and the left-rear side. The original image is embedded at build
time, with no requests to Tesla at runtime. Tesla retains ownership of its artwork.

The charger is not part of this image. The card draws a cable, connector and
charge-flap overlay in SVG. Only the cable pulse animates during charging;
the whole overlay hides when disconnected. Image and SVG share the same crop
coordinates so that they scale together. The SVG is a visual approximation of
the connection rather than a Tesla-supplied open-port render.

Source URL, configuration and checksum are recorded in
`model-3-highland-white-nova.source.json`. The full downloaded archive remains
local and is excluded from Git and the release bundle.

## Previous generated scenes (retained, no longer bundled)

`model-3-2025-white-nova.png` is a generated transparent render based on the
approved rear-left Model 3 concept. The left rear taillight charge port faces the
viewer; the vehicle nose points left. It is approximate artwork, not an official
Tesla asset. The image includes the charger and cable.

`model-3-2025-white-nova-disconnected.png` is the matching scene without the cable,
with the charge flap closed. Selected when the configured connection sensor is off.

Generated with the built-in image-generation tool. Prompt records are in
`docs/vehicle-asset-prompts.md`. Use `vehicle_image` to override the full scene.

Original Model Y RWD selections reuse the corresponding Long Range AWD image
and cable anchor. The explicit local mapping is stored in vehicles/aliases.json;
source option codes and source provenance remain unchanged.
