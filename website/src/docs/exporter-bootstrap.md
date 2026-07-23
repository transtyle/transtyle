---
title: 'Bootstrap exporter'
description: 'Sass-path and CSS-variable-path Bootstrap themes — the exporter that replaces tint-color() with OKLCH.'
order: 11
---

# Bootstrap exporter

Emits a **Bootstrap ≥5.3** theme along both consumption paths the Bootstrap community actually uses:

| File                        | Path          | Fidelity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_variables.transtyle.scss` | Sass          | full — imported **before** Bootstrap, so `$primary`, radii, fonts, spacers compile into every component                                                                                                                                                                                                                                                                                                                                                                                                          |
| `_maps.transtyle.scss`      | Sass          | full — imported **after** Bootstrap's variables; **replaces** its sRGB `tint-color()`/`shade-color()` derivations with our OKLCH-derived subtle/emphasis values                                                                                                                                                                                                                                                                                                                                                  |
| `bootstrap-theme.css`       | CSS variables | partial, documented — rethemes the token tier (`--bs-*`, utilities, body, borders, `[data-bs-theme=dark]` block) **and** the per-component variable layer: structure blocks (button/badge/toast paddings, radii, transitions) plus `.btn-<variant>` state colors from the role grid in both modes, so `.btn-primary` backgrounds/hovers follow your brand even without Sass. Still out of reach: values with no runtime variable (Sass-only expressions, responsive re-sets). Use it when you have no Sass build |

```json
"targets": { "bootstrap": { "output": "dist/bootstrap" } }
```

```scss
// your main.scss — the generated usage.md carries this exact order
@import 'bootstrap/scss/functions';
@import '../dist/bootstrap/variables.transtyle';
@import 'bootstrap/scss/variables';
@import 'bootstrap/scss/variables-dark';
@import '../dist/bootstrap/maps.transtyle';
@import 'bootstrap/scss/bootstrap';
```

## The interesting part: we out-derive Bootstrap on its own turf

Bootstrap generates `-bg-subtle` / `-border-subtle` / `-text-emphasis` per theme color by sRGB tinting. This exporter overrides those maps with the engine's OKLCH derivations — `<role>.on-tint` is the AA-checked "on-brand walk", `<role>.tint` a perceptual mix toward your surface, and `<role>.outline` (the border-subtle source) is now a first-class [role-grid](/docs/language/#color-roles-the-role-grid) cell rather than a private exporter formula — so alerts and subtle badges stay perceptually consistent across all roles and both modes.

## Mapping highlights

| Bootstrap variable                                        | Comes from                                                                         | Note                                                                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `$primary…$danger`                                        | the same-named roles' `.solid`                                                     | `secondary…danger` usually `derived` on minimal systems                                                                                       |
| `$light` / `$dark`                                        | `neutral.tint` / `neutral.text-strong`                                             | exporter convention — Bootstrap's grayscale pseudo-roles have no IR slot                                                                      |
| `$theme-colors-text`                                      | `<role>.on-tint`                                                                   | the native binding the Phase 0 exercise predicted                                                                                             |
| `$theme-colors-bg-subtle` / `-border-subtle`              | `<role>.tint` / `<role>.outline`                                                   | cartesian-OKLab mixes, both engine-owned grid cells                                                                                           |
| `$body-*`, `$border-color` (+ `-dark` variants)           | `elevation.{0,1}.surface` / `text.base` / `text.muted` / `neutral.tint` / `border` |                                                                                                                                               |
| `$link-color`, `$focus-ring-color`                        | `primary`, `ring`                                                                  | dark-mode links ← `ring[dark]` (visibility-lightened)                                                                                         |
| `$border-radius{,-sm,-lg,-xl,-pill}`                      | the `radius.*` scale                                                               | `sm/lg/xl` derived from your `md`                                                                                                             |
| `$font-family-*`, type scale, `$spacers`, `$box-shadow*`  | fonts, the engine's `type.*`/`space.*` scales, scrim alpha ramps                   | scales report `derived` until you author them                                                                                                 |
| `$btn-*`, `$modal-*`, … (the 657-variable component tier) | `component.*` tokens + semantic defaults                                           | AL1: bound by meaning per the checked-in surface inventory — one coverage row per variable (driven, chained, or honestly dropped/unsupported) |
| `$grid-breakpoints`, `$box-shadow-inset`                  | —                                                                                  | `unsupported`, reported honestly                                                                                                              |

Dark mode follows Bootstrap's own mechanism (`data-bs-theme="dark"`) on both paths. One Sass-path caveat inherited from Bootstrap itself: `$primary` is a single value, so brand colors don't flip per mode — exactly how Bootstrap's own dark mode behaves.

See it running on real Bootstrap components: `npm run dev -w acme-demo-bootstrap` (or `cathode-demo-bootstrap` for the CRT version) in the [examples](/docs/examples/).
