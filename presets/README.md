# Presets

Effect presets that tools apply because scripts cannot set some options.

- **Compound Blur (Effects & Masks).ffx** (optional): Compound Blur with *Blur Layer* set to **Effects & Masks**.
  When this file exists, Spot Blur keeps `blur.Map` as a masked solid in the same comp; without it,
  `blur.Map` is a precomp (its *Source* already contains the masks).
  To make it in After Effects: apply Compound Blur to any layer, pick a Blur Layer, switch the second menu to
  *Effects & Masks*, select the effect, then Animation > Save Animation Preset... with this exact file name.
