# Vehicle artwork

## Current bundled render

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
