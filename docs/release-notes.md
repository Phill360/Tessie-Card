# Tessie Card 0.2.4 — trim colour and RWD selection

- Renames the drivetrain selector to Vehicle variant and the interior selector
  to Trim colour, showing only Black or White where available.
- Groups duplicate interior codes under their colour while retaining existing
  saved selections. Compatible colour choices survive variant changes.
- Adds Rear-Wheel Drive for the original 2020–2024 Model Y generation, using
  matching Long Range AWD artwork. This is an artwork alias rather than a new
  Tesla API option code, and it does not change the physical vehicle controlled.
- Covers 388 selectable appearance configurations with the same 304 prepared
  images and corrected cable registration from 0.2.3.

Validation: 20 automated tests plus browser checks for the colour labels, RWD
selection, dependent artwork options, charging animation and vehicle isolation.
Install the test prerelease in HACS and fully reload the dashboard.
