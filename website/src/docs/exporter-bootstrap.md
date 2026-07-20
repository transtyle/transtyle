---
title: "Bootstrap exporter"
description: "Sass-path and CSS-variable-path Bootstrap themes — the exporter that replaces tint-color() with OKLCH."
order: 11
---

# Bootstrap exporter

Emits a **Bootstrap ≥5.3** theme along both consumption paths the Bootstrap community actually uses:

| File | Path | Fidelity |
|---|---|---|
| `_variables.transtyle.scss` | Sass | full — imported **before** Bootstrap, so `$primary`, radii, fonts, spacers compile into every component |
| `_maps.transtyle.scss` | Sass | full — imported **after** Bootstrap's variables; **replaces** its sRGB `tint-color()`/`shade-color()` derivations with our OKLCH-derived subtle/emphasis values |
| `bootstrap-theme.css` | CSS variables | partial, documented — rethemes the token tier (`--bs-*`, utilities, body, borders, `[data-bs-theme=dark]` block) but cannot reach values Sass baked into component rules (`.btn-primary` backgrounds/hovers stay stock). Use it when you have no Sass build |

```json
"targets": { "bootstrap": { "output": "dist/bootstrap" } }
```

```scss
// your main.scss — the generated usage.md carries this exact order
@import "bootstrap/scss/functions";
@import "../dist/bootstrap/variables.transtyle";
@import "bootstrap/scss/variables";
@import "bootstrap/scss/variables-dark";
@import "../dist/bootstrap/maps.transtyle";
@import "bootstrap/scss/bootstrap";
```

## The interesting part: we out-derive Bootstrap on its own turf

Bootstrap generates `-bg-subtle` / `-border-subtle` / `-text-emphasis` per theme color by sRGB tinting. This exporter overrides those maps with the engine's OKLCH derivations — `text-on-<role>.subtle` is the AA-checked "on-brand walk", `<role>.subtle` a perceptual mix toward your surface — so alerts and subtle badges stay perceptually consistent across all roles and both modes.

## Mapping highlights

| Bootstrap variable | Comes from | Note |
|---|---|---|
| `$primary…$danger` | the same-named roles' `.base` | `secondary…danger` usually `derived` on minimal systems |
| `$light` / `$dark` | `neutral.subtle` / `neutral.contrast` | exporter convention — Bootstrap's grayscale pseudo-roles have no IR slot |
| `$theme-colors-text` | `text-on-<role>.subtle` | the native binding the Phase 0 exercise predicted |
| `$theme-colors-bg-subtle` / `-border-subtle` | `<role>.subtle` / `mix(role, surface, 0.70)` | cartesian-OKLab mixes |
| `$body-*`, `$border-color` (+ `-dark` variants) | `background/text/text-muted/surface/neutral.subtle/border` | |
| `$link-color`, `$focus-ring-color` | `primary`, `ring` | dark-mode links ← `ring[dark]` (visibility-lightened) |
| `$border-radius{,-sm,-lg,-xl,-pill}` | the `radius.*` scale | `sm/lg/xl` derived from your `md` |
| `$font-family-*`, type scale, `$spacers`, `$box-shadow*` | fonts, defaulted modular/linear scales, scrim alpha ramps | scales report `derived` until you author them |
| `$grid-breakpoints`, `$btn-*` component tier, `$box-shadow-inset` | — | `unsupported`, reported honestly |

Dark mode follows Bootstrap's own mechanism (`data-bs-theme="dark"`) on both paths. One Sass-path caveat inherited from Bootstrap itself: `$primary` is a single value, so brand colors don't flip per mode — exactly how Bootstrap's own dark mode behaves.

See it running on real Bootstrap components: `npm run dev -w acme-demo-bootstrap` (or `cathode-demo-bootstrap` for the CRT version) in the [examples](/docs/examples/).
