# Tessie Card 0.2.3 — vehicle framing correction

Corrects inconsistent vehicle size and detached charging cables when changing
paint, interior or wheel options. The original Model Y Gemini render is the
reference for apparent vehicle width and top position.

- Measures the main opaque car silhouette instead of cropping around stray
  compositor pixels in the transparent background.
- Rebuilds all 304 prepared images with consistent framing while preserving
  the car's proportions. The 368 saved appearance combinations are retained.
- Projects each charge-port anchor using the same image scale and offset,
  keeping the connector attached when artwork changes.
- Adds artifact framing checks and regression coverage for source padding,
  isolated pixels and the Model Y Gemini/Induction case.

The card configuration and charging controls are unchanged. Front-view fallbacks
continue to hide the cable. Testing uses simulated Home Assistant data; the
reported live screenshots were used as the visual reference.

Install the v0.2.3 test prerelease through HACS and fully reload the dashboard so
its embedded images replace the previous cached module.
