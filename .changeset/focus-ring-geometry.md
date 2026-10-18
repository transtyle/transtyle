---
'@transtyle/ir': minor
'@transtyle/core': minor
'@transtyle/exporter-primeng': minor
'@transtyle/exporter-chakra': minor
'@transtyle/exporter-mui': minor
'@transtyle/exporter-bootstrap': minor
'@transtyle/exporter-css-variables': minor
'@transtyle/exporter-mantine': patch
'@transtyle/exporter-daisyui': patch
'@transtyle/exporter-radix': patch
'@transtyle/exporter-shadcn': patch
---

The catalog gains the focus ring's geometry: `semantic.ring.width` and `semantic.ring.offset`, two scalars next to `semantic.color.ring` (proposal 0002, row 8, #167).

The width defaults to `{semantic.border-width.medium}` (2px) and the offset to 2px. There is no style and no shadow slot, and no composite: every outline-family library draws a solid ring, and Chakra UI, Material UI, Adobe Spectrum and Material 3 all publish the width and the offset as separate values. The targets write them only when you author them (the width itself, or through `border-width.medium`), so a design system that doesn't keeps each library's own ring: PrimeNG's `focusRing.width` and `.offset`, Chakra's `--focus-ring-width` and `--focus-ring-offset` on `<html>` (every `focusVisibleRing` variant reads them), Material UI's `focusVisible.outlineWidth` and `.outlineOffset`, and Bootstrap's `$focus-ring-width` (its ring is a box-shadow halo with no gap, so the offset is reported `dropped`). The css-variables target writes `--ring-width` and `--ring-offset` for everyone. Mantine, daisyUI, Radix Themes and shadcn/ui draw their rings in component CSS and report both slots `dropped`. The GOV.UK example authors its 3px `$govuk-focus-width`, so its PrimeNG, Chakra, Material UI and Bootstrap themes now draw a 3px ring.

`isAuthored(map, path)` in `@transtyle/ir` is the test the exporters share: `authored` or `aliased`, or an `alias(<slot>)` default of a slot the design system authored. `transtyle catalog` lists 266 slots.
