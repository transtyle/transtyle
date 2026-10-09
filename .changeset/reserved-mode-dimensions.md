---
'@transtyle/ir': minor
'@transtyle/core': minor
'@transtyle/cli': minor
'@transtyle/exporter-css-variables': minor
'@transtyle/exporter-shadcn': minor
'@transtyle/exporter-radix': minor
'@transtyle/exporter-bootstrap': minor
'@transtyle/exporter-daisyui': minor
'@transtyle/exporter-storybook': minor
'@transtyle/exporter-primeng': minor
'@transtyle/exporter-echarts': minor
'@transtyle/exporter-mantine': minor
'@transtyle/exporter-chakra': minor
'@transtyle/exporter-mui': minor
---

The reserved `contrast`, `motion` and `brand` mode dimensions now reach the targets. A mode-scoped layer may name several dimensions (`"mode": { "color-scheme": "dark", "contrast": "more" }`): its values apply to that combination only, and win there; a token with values on two dimensions and no such layer is reported `TST1125`. Under `contrast: more` the derived on-colors and content text aim at 7:1 (rule `contrast-more`) and `check` holds every `more` combination to 7:1; under `motion: reduced` every unauthored duration is `0ms` (rule `motion-reduced`). `check` now measures every combination of the mode matrix, and `explain --mode` lists the combination keys it accepts.

CSS targets (css-variables, shadcn, Radix, Bootstrap's `bootstrap-theme.css`) add `[data-contrast]`, `[data-motion]` and `[data-brand]` blocks, a compound block for each combination the separate ones would get wrong (dark + more contrast used to get the light values in css-variables), and `@media (prefers-contrast: more)` / `(prefers-reduced-motion: reduce)` copies so the OS setting applies until the page sets the attribute (css-variables: `options.mediaQueries: false` turns them off). daisyUI emits one theme per brand and contrast combination, ECharts one theme per brand and scheme, Storybook a toolbar per dimension, and Bootstrap's Sass files, PrimeNG, Mantine, Chakra and MUI one file per brand (`preset.transtyle.<brand>.ts`). A target that can't express a dimension reports a `dropped` row with its reason. `brand` values must be lowercase names (`^[a-z0-9][a-z0-9-]*$`). `@transtyle/ir` exports the helpers (`modeBlocks`, `emitPerValue`, `pinDimension`, `MODE_MEDIA_QUERIES`). A design system that declares none of these dimensions compiles to the same files as before.
